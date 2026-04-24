import { useState, useCallback, useRef } from 'react';
import { ChatMessage, CellEditAction, AiProviderConfig, AiMode } from '../types/ai';
import { AppMappingItem } from '../types/template';
import { getAiSettings } from '../services/ai/ai-settings';
import { sendAiMessage } from '../services/ai/ai-bridge';
import { buildSystemPrompt } from '../services/ai/ai-context-builder';
import { parseAiResponse } from '../services/ai/ai-response-parser';
import { AppMappingItem as MappingItem } from '../types/template';
import { TOOL_REGISTRY, buildToolsPromptSection } from '../services/ai/tools/tool-registry';
import { parseToolCall, executeToolCall } from '../services/ai/tools/tool-executor';

interface UseAiChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  pendingActions: CellEditAction[] | null;
  sendMessage: (text: string, images?: string[], mode?: AiMode, activeToolNames?: string[]) => Promise<void>;
  abortGeneration: () => void;
  applyPendingActions: () => void;
  rejectPendingActions: () => void;
  clearMessages: () => void;
}

function getCurrentSheetId(): string {
  try {
    const sc = (window as any).SocialCalc;
    return sc?.GetCurrentWorkBookControl()?.currentSheetButton?.id || 'sheet1';
  } catch {
    return 'sheet1';
  }
}

function applyCellActions(actions: CellEditAction[]) {
  const sc = (window as any).SocialCalc;
  if (!sc) { console.error('[AiChat] SocialCalc not found on window'); return; }

  const control = sc.GetCurrentWorkBookControl();
  if (!control) { console.error('[AiChat] No workbook control'); return; }

  const currsheet = control.currentSheetButton?.id || 'sheet1';

  // Build SocialCalc commands for all actions
  const cmds: string[] = [];
  for (const action of actions) {
    if (action.type === 'formula') {
      cmds.push(`set ${action.coord} formula ${action.value}`);
    } else {
      const val = String(action.value);
      const numVal = parseFloat(val);
      if (!isNaN(numVal) && isFinite(numVal as any) && val.trim() === numVal.toString()) {
        cmds.push(`set ${action.coord} value n ${numVal}`);
      } else {
        const encoded = sc.encodeForSave ? sc.encodeForSave(val) : val;
        cmds.push(`set ${action.coord} text t ${encoded}`);
      }
    }

    // Apply formatting if provided
    if (action.formatting?.fontColor) {
      cmds.push(`set ${action.coord} color ${action.formatting.fontColor}`);
    }
    if (action.formatting?.bgColor) {
      cmds.push(`set ${action.coord} bgcolor ${action.formatting.bgColor}`);
    }
  }

  if (cmds.length === 0) return;

  // Execute as a single batch command via the workbook control
  const cmdstr = cmds.join('\n') + '\n';
  const commandObj = {
    cmdtype: 'scmd',
    id: currsheet,
    cmdstr: cmdstr,
    saveundo: true,
  };

  try {
    control.ExecuteWorkBookControlCommand(commandObj, false);
  } catch (err) {
    console.error('[AiChat] Failed to execute SocialCalc commands:', err);
  }
}

export function useAiChat(
  appMapping: Record<string, Record<string, AppMappingItem>> | undefined,
): UseAiChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<CellEditAction[] | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (
    text: string,
    images?: string[],
    mode: AiMode = 'auto',
    activeToolNames: string[] = [],
  ) => {
    const config = getAiSettings();
    setError(null);
    setIsLoading(true);

    // Create a fresh AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Get fresh sheet ID at message-send time (not render time)
    const sheetId = getCurrentSheetId();

    const userMessage: ChatMessage = {
      role: 'user',
      content: text,
      ...(images && images.length > 0 ? { images } : {}),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      // Build fresh system prompt with current cell values, mode, and active tools
      const enabledTools = TOOL_REGISTRY.filter(t => activeToolNames.includes(t.name));
      let systemPrompt = buildSystemPrompt(appMapping, sheetId, mode);
      if (enabledTools.length > 0) {
        systemPrompt += '\n\n' + buildToolsPromptSection(enabledTools);
      }

      // Build message history for the AI (exclude tool-call display messages)
      let currentAiMessages: ChatMessage[] = [
        { role: 'system', content: systemPrompt, timestamp: 0 },
        ...messages.filter(m => m.role !== 'system' && !m.toolCallInfo),
        userMessage,
      ];

      // ── Tool-calling loop ────────────────────────────────────────────────────
      let rawResponse = '';
      const MAX_TOOL_ITERATIONS = 5;
      for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
        rawResponse = await sendAiMessage(config, currentAiMessages, controller.signal);

        if (enabledTools.length === 0) break; // no tools, single pass

        const toolCall = parseToolCall(rawResponse);
        if (!toolCall) break; // no tool call → normal response

        // Check the requested tool is actually enabled (match by name or label)
        const lower = toolCall.name.toLowerCase();
        const toolDef = enabledTools.find(
          t => t.name === toolCall.name || t.label === toolCall.name ||
               t.name.toLowerCase() === lower || t.label.toLowerCase() === lower,
        );
        if (!toolDef) break;

        // Execute tool
        const toolResult = await executeToolCall(toolCall);

        // Show tool call as a special message in the chat
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '',
          toolCallInfo: {
            name: toolCall.name,
            parameters: toolCall.parameters,
            result: toolResult.result,
            error: toolResult.error,
          },
          timestamp: Date.now(),
        }]);

        // Feed result back into AI message history
        currentAiMessages = [
          ...currentAiMessages,
          { role: 'assistant', content: rawResponse, timestamp: Date.now() },
          {
            role: 'user',
            content: `[TOOL_RESULT: ${toolCall.name}]\n${
              toolResult.error
                ? `Error: ${toolResult.error}`
                : JSON.stringify(toolResult.result, null, 2)
            }\n\nNow use this result to complete the user's original request. If you need more information, call another tool. Otherwise, provide your final answer or output the JSON edits.`,
            timestamp: Date.now(),
          },
        ];
      }
      // ────────────────────────────────────────────────────────────────────────

      // Parse response for actions
      const { message: displayMessage, actions } = parseAiResponse(rawResponse);

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: displayMessage,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // If there are actions, validate and apply/queue them
      if (actions && actions.length > 0) {
        const validated = validateActions(actions, appMapping, sheetId);

        if (validated.length > 0) {
          // Always queue for user confirmation — never auto-apply.
          setPendingActions(validated);
        } else if (actions.length > 0) {
          // Actions were parsed but all filtered out by validation
          const warnMsg: ChatMessage = {
            role: 'assistant',
            content: `Note: The suggested edits target non-editable cells and were skipped.`,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, warnMsg]);
        }
      }
    } catch (err: any) {
      // Ignore abort errors — user intentionally stopped generation
      if (err.name === 'AbortError') {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'Generation stopped.', timestamp: Date.now() },
        ]);
      } else {
        const errorMsg = err.message || 'Failed to get AI response';
        setError(errorMsg);
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: `Error: ${errorMsg}`, timestamp: Date.now() },
        ]);
      }
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, [appMapping, messages]); // eslint-disable-line react-hooks/exhaustive-deps

  const abortGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
  }, []);

  const applyPendingActions = useCallback(() => {
    if (!pendingActions) return;

    applyCellActions(pendingActions);

    const count = pendingActions.length;
    const confirmMsg: ChatMessage = {
      role: 'assistant',
      content: `Applied ${count} cell edit${count > 1 ? 's' : ''} successfully.`,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, confirmMsg]);
    setPendingActions(null);
  }, [pendingActions]);

  const rejectPendingActions = useCallback(() => {
    const rejectMsg: ChatMessage = {
      role: 'assistant',
      content: 'Cell edits cancelled.',
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, rejectMsg]);
    setPendingActions(null);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setPendingActions(null);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    pendingActions,
    sendMessage,
    abortGeneration,
    applyPendingActions,
    rejectPendingActions,
    clearMessages,
  };
}

/**
 * Build a set of all editable cell coordinates directly from appMapping
 * for the given sheet. Handles text, form, and table types.
 */
function buildEditableCoordsFromMapping(
  appMapping: Record<string, Record<string, AppMappingItem>> | undefined,
  sheetId: string
): Set<string> {
  const coords = new Set<string>();
  if (!appMapping) return coords;

  const sheetMapping = appMapping[sheetId];
  if (!sheetMapping) return coords;

  for (const [, item] of Object.entries(sheetMapping)) {
    // Simple text field
    if (item.type === 'text' && item.editable && item.cell) {
      coords.add(item.cell.toUpperCase());
    }
    // Form with sub-fields
    if (item.type === 'form' && item.formContent) {
      for (const [, sub] of Object.entries(item.formContent)) {
        const subItem = sub as MappingItem;
        if (subItem.editable && subItem.cell) {
          coords.add(subItem.cell.toUpperCase());
        }
      }
    }
    // Table with row ranges
    if (item.type === 'table' && item.rows && item.col) {
      for (const [, colDef] of Object.entries(item.col)) {
        const col = colDef as MappingItem;
        if (col.editable && col.cell) {
          const colLetter = col.cell.replace(/[0-9]/g, '').toUpperCase();
          for (let row = item.rows.start; row <= item.rows.end; row++) {
            coords.add(`${colLetter}${row}`);
          }
        }
      }
    }
  }

  return coords;
}

function validateActions(
  actions: CellEditAction[],
  appMapping: Record<string, Record<string, AppMappingItem>> | undefined,
  sheetId: string
): CellEditAction[] {
  if (!appMapping) return actions;

  const editableCoords = buildEditableCoordsFromMapping(appMapping, sheetId);

  // If we couldn't build any editable coords (mapping issue), allow all actions
  if (editableCoords.size === 0) return actions;

  return actions.filter(action => {
    const coord = action.coord.toUpperCase();
    return editableCoords.has(coord);
  });
}
