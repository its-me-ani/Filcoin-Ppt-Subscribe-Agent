export interface ToolParameter {
  type: 'string' | 'number' | 'boolean';
  description: string;
  required?: boolean;
  default?: any;
}

export interface ToolDefinition {
  name: string;         // unique machine name, e.g. "search_inventory"
  label: string;        // display name shown in UI
  description: string;  // sent to AI in system prompt
  category?: string;
  parameters: Record<string, ToolParameter>;
  /** The actual executor function — receives validated params, returns any serialisable value */
  executor: (params: Record<string, any>) => any | Promise<any>;
}

export interface ToolCall {
  name: string;
  parameters: Record<string, any>;
}

export interface ToolCallResult {
  toolName: string;
  parameters: Record<string, any>;
  result?: any;
  error?: string;
}
