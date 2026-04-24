import { AiResponse, CellEditAction } from '../../types/ai';

const CELL_REF_REGEX = /^[A-Z]{1,3}\d{1,5}$/;

function isValidCellRef(coord: string): boolean {
  return CELL_REF_REGEX.test(coord);
}

function isValidActionType(type: string): type is CellEditAction['type'] {
  return type === 'text' || type === 'value' || type === 'formula';
}

function extractActionsFromObject(obj: any): CellEditAction[] {
  const rawActions = obj.actions || obj.action || obj.edits || obj.changes;
  const arr = Array.isArray(rawActions) ? rawActions : rawActions ? [rawActions] : [];

  return arr.filter((action: any) => {
    if (!action.coord || !isValidCellRef(action.coord)) return false;
    if (action.value === undefined || action.value === null) return false;
    return true;
  }).map((action: any) => ({
    coord: action.coord,
    value: action.value,
    type: isValidActionType(action.type) ? action.type : 'text',
    formatting: action.formatting,
  }));
}

function tryParseJson(text: string): CellEditAction[] | null {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null) {
      const actions = extractActionsFromObject(parsed);
      if (actions.length > 0) return actions;
    }
  } catch { /* not valid JSON */ }
  return null;
}

/**
 * Try to extract cell edit commands from natural language patterns.
 * Handles cases where the AI describes edits without proper JSON.
 * E.g.: "I'll set C18 to 'INV-999'" or "Setting cell E18 to March 15"
 */
function extractFromNaturalLanguage(text: string): CellEditAction[] {
  const actions: CellEditAction[] = [];

  // Pattern: set/change/update CELL to VALUE
  const patterns = [
    /(?:set|change|update|modify)\s+(?:cell\s+)?([A-Z]{1,3}\d{1,5})\s+to\s+["']?([^"'\n,]+?)["']?(?:\s*[.,]|\s*$)/gi,
    /([A-Z]{1,3}\d{1,5})\s*(?:→|->|=>|:)\s*["']?([^"'\n,]+?)["']?(?:\s*[.,]|\s*$)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const coord = match[1].toUpperCase();
      const value = match[2].trim();
      if (isValidCellRef(coord) && value) {
        actions.push({ coord, value, type: 'text' });
      }
    }
  }

  return actions;
}

export function parseAiResponse(responseText: string): AiResponse {
  let actions: CellEditAction[] = [];
  let message = responseText;

  // Strategy 1: Look for ```json ... ``` fenced blocks
  const jsonBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    const result = tryParseJson(jsonBlockMatch[1].trim());
    if (result) {
      actions = result;
      message = responseText.replace(/```(?:json)?\s*[\s\S]*?\s*```/g, '').trim();
    }
  }

  // Strategy 2: Look for raw JSON object with actions/action/edits key
  if (actions.length === 0) {
    const rawJsonMatch = responseText.match(/\{[\s\S]*?"(?:actions|action|edits|changes)"[\s\S]*?\}/);
    if (rawJsonMatch) {
      const result = tryParseJson(rawJsonMatch[0]);
      if (result) {
        actions = result;
        message = responseText.replace(rawJsonMatch[0], '').trim();
      }
    }
  }

  // Strategy 3: Try to find any JSON array with coord/value objects
  if (actions.length === 0) {
    const arrayMatch = responseText.match(/\[\s*\{[\s\S]*?"coord"[\s\S]*?\}\s*\]/);
    if (arrayMatch) {
      const result = tryParseJson(`{"actions":${arrayMatch[0]}}`);
      if (result) {
        actions = result;
        message = responseText.replace(arrayMatch[0], '').trim();
      }
    }
  }

  // Strategy 4: Extract from natural language patterns
  if (actions.length === 0) {
    actions = extractFromNaturalLanguage(responseText);
    // Don't strip message for NL extraction — the text IS the message
  }

  // Strip any remaining JSON action blocks (even empty ones) that weren't extracted
  message = message
    .replace(/\{[\s\S]*?"(?:actions|action|edits|changes)"[\s\S]*?\}/g, '')
    .replace(/```(?:json)?\s*[\s\S]*?```/g, '');

  // Strip AI-generated confirmation phrases — the system handles apply confirmation
  message = message
    .replace(/applied\s+\d+\s+cell\s+edit[s]?\s+successfully\.?/gi, '')
    .replace(/\d+\s+cell\s+edit[s]?\s+(have been\s+)?applied\.?/gi, '')
    .replace(/successfully\s+applied\s+\d+\s+(cell\s+)?edit[s]?\.?/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    message: message || responseText,
    actions: actions.length > 0 ? actions : undefined,
  };
}
