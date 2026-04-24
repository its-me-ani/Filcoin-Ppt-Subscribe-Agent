import { ToolCall, ToolCallResult } from '../../../types/tools';
import { getToolByName } from './tool-registry';

/** Parse a tool_call fenced block from an AI response. Returns null if none found. */
export function parseToolCall(text: string): ToolCall | null {
  // 1. Fenced block: ```tool_call\n{...}\n```
  const fenced = text.match(/```tool_call\s*\n([\s\S]*?)\n?\s*```/);
  if (fenced) {
    try {
      const parsed = JSON.parse(fenced[1].trim());
      if (parsed.name && typeof parsed.name === 'string') {
        return { name: parsed.name, parameters: parsed.parameters ?? {} };
      }
    } catch { /* bad JSON */ }
  }

  // 2. XML-style: <tool_call>...</tool_call> or <tool_call>...<tool_call>
  //    Some models (Kimi, Qwen, etc.) emit this format natively.
  const xmlMatch = text.match(/<tool_call>([\s\S]*?)(?:<\/tool_call>|<tool_call>|$)/);
  if (xmlMatch) {
    // Strip an optional leading "call" keyword some models prepend
    const jsonStr = xmlMatch[1].trim().replace(/^call\s*/i, '').trim();
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.name && typeof parsed.name === 'string') {
        return { name: parsed.name, parameters: parsed.parameters ?? {} };
      }
    } catch { /* bad JSON */ }
  }

  // 3. Inline JSON: {"tool_call": {"name": "...", "parameters": {...}}}
  const inline = text.match(/\{"tool_call"\s*:\s*(\{[\s\S]*?\})\s*\}/);
  if (inline) {
    try {
      const parsed = JSON.parse(inline[1]);
      if (parsed.name) return { name: parsed.name, parameters: parsed.parameters ?? {} };
    } catch { /* bad JSON */ }
  }

  // 4. Bare JSON object: {"name":"TOOL_NAME","parameters":{...}}
  //    Some models emit this as their entire response with no wrapper.
  const bare = text.trim();
  if (bare.startsWith('{') && bare.endsWith('}')) {
    try {
      const parsed = JSON.parse(bare);
      if (parsed.name && typeof parsed.name === 'string' && 'parameters' in parsed) {
        return { name: parsed.name, parameters: parsed.parameters ?? {} };
      }
    } catch { /* bad JSON */ }
  }

  return null;
}

/** Execute a parsed tool call and return the result. */
export async function executeToolCall(call: ToolCall): Promise<ToolCallResult> {
  const tool = getToolByName(call.name);

  if (!tool) {
    return { toolName: call.name, parameters: call.parameters, error: `Unknown tool: "${call.name}"` };
  }

  try {
    const result = await Promise.resolve(tool.executor(call.parameters));
    return { toolName: call.name, parameters: call.parameters, result };
  } catch (err: any) {
    return { toolName: call.name, parameters: call.parameters, error: err?.message ?? 'Tool execution failed' };
  }
}
