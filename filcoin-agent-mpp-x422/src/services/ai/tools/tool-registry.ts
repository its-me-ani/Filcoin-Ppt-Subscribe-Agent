import { ToolDefinition } from '../../../types/tools';
import { searchInventory } from './inventory-tool';

/**
 * Central registry of all available tools.
 * To add a new tool: create its executor in a new file and push a new entry here.
 */
export const TOOL_REGISTRY: ToolDefinition[] = [
  {
    name: 'search_inventory',
    label: 'Inventory Search',
    description:
      'Search the product/service inventory for items by name, description, or category. ' +
      'Returns matching items with their unit price, unit, and category.',
    category: 'Data',
    parameters: {
      query: {
        type: 'string',
        description: 'Search term — item name, description keyword, or category. Pass an empty string "" to list ALL inventory items.',
        required: true,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10)',
        required: false,
        default: 10,
      },
    },
    executor: searchInventory,
  },
  // ── Add more tools here ─────────────────────────────────────────────────────
  // {
  //   name: 'get_exchange_rate',
  //   label: 'Currency Converter',
  //   description: 'Convert an amount from one currency to another.',
  //   parameters: {
  //     from: { type: 'string', description: 'Source currency code, e.g. USD', required: true },
  //     to:   { type: 'string', description: 'Target currency code, e.g. EUR', required: true },
  //   },
  //   executor: getExchangeRate,
  // },
];

export function getToolByName(name: string): ToolDefinition | undefined {
  const lower = name.toLowerCase();
  return TOOL_REGISTRY.find(
    t => t.name === name || t.label === name || t.name.toLowerCase() === lower || t.label.toLowerCase() === lower,
  );
}

/** Build the tools section appended to the system prompt when tools are active. */
export function buildToolsPromptSection(enabledTools: ToolDefinition[]): string {
  if (enabledTools.length === 0) return '';

  const toolList = enabledTools.map(tool => {
    const params = Object.entries(tool.parameters)
      .map(([k, p]) =>
        `    - ${k} (${p.type}${p.required ? ', required' : ', optional'}): ${p.description}`,
      )
      .join('\n');
    return `- **${tool.label}** \`${tool.name}\`\n  ${tool.description}\n  Parameters:\n${params}`;
  }).join('\n\n');

  return `## TOOLS

You have access to these tools. Use them ONLY when the user's request explicitly needs data from that source (e.g. looking up an item price or description before adding it to the invoice). Do NOT call a tool if you already have the information you need from the invoice data above.

To call a tool, output ONLY the following JSON on its own — no extra text before or after:
{"name":"TOOL_NAME","parameters":{"param":"value"}}

The system will execute the tool and return a [TOOL_RESULT]. Use that result to complete your answer.
Do NOT guess or invent tool results — always wait for the actual [TOOL_RESULT] before answering.
After receiving a [TOOL_RESULT], continue working until the user's full request is satisfied (make additional tool calls if needed, then output the final answer or JSON edits).

Available tools:
${toolList}`;
}
