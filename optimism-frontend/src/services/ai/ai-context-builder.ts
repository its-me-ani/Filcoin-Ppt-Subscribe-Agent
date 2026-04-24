import { AppMappingItem } from '../../types/template';
import { AiMode } from '../../types/ai';

function getSheet(sheetId: string): any | null {
  try {
    const sc = (window as any).SocialCalc;
    if (!sc) return null;
    const control = sc.GetCurrentWorkBookControl();
    if (!control?.workbook?.sheetArr?.[sheetId]?.sheet) return null;
    return control.workbook.sheetArr[sheetId].sheet;
  } catch {
    return null;
  }
}

function readCellValue(sheet: any, cellRef: string): string | number {
  if (!sheet?.cells) return '';
  const cell = sheet.cells[cellRef];
  if (!cell) return '';
  if (cell.datatype === 'v' || cell.valuetype === 'n') {
    return cell.datavalue !== undefined ? cell.datavalue : '';
  }
  if (cell.datatype === 't') {
    return cell.datavalue !== undefined ? String(cell.datavalue) : '';
  }
  if (cell.datatype === 'f') {
    return cell.valuetype === 'n' ? cell.datavalue : (cell.displaystring || '');
  }
  return cell.displaystring || cell.datavalue || '';
}

function cleanValue(val: string | number): string {
  if (typeof val === 'number') return String(val);
  return String(val)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ColDef {
  label: string;
  colLetter: string;
  editable: boolean;
}

interface TableData {
  name: string;
  rowStart: number;
  rowEnd: number;
  cols: ColDef[];
  nextEmptyRow: number | null;
  existingRows: { rowNum: number; cells: { label: string; cell: string; value: string; editable: boolean }[] }[];
}

function buildTableData(
  appMapping: Record<string, Record<string, AppMappingItem>>,
  sheetId: string,
  sheet: any | null,
): TableData[] {
  const sheetMapping = appMapping[sheetId];
  if (!sheetMapping) return [];

  const tables: TableData[] = [];

  for (const [label, item] of Object.entries(sheetMapping)) {
    if (item.type !== 'table' || !item.rows || !item.col) continue;

    const cols: ColDef[] = [];
    for (const [colLabel, colItemRaw] of Object.entries(item.col)) {
      const colItem = colItemRaw as AppMappingItem;
      if (colItem.cell) {
        cols.push({
          label: colLabel,
          colLetter: colItem.cell.replace(/[0-9]/g, '').toUpperCase(),
          editable: colItem.editable ?? false,
        });
      }
    }

    let nextEmptyRow: number | null = null;
    const existingRows: TableData['existingRows'] = [];

    for (let row = item.rows.start; row <= item.rows.end; row++) {
      const cells: TableData['existingRows'][0]['cells'] = [];
      let hasContent = false;

      for (const col of cols) {
        const cellRef = `${col.colLetter}${row}`;
        const val = sheet ? cleanValue(readCellValue(sheet, cellRef)) : '';
        if (val) hasContent = true;
        cells.push({ label: col.label, cell: cellRef, value: val, editable: col.editable });
      }

      if (hasContent) {
        existingRows.push({ rowNum: row, cells });
      } else if (nextEmptyRow === null) {
        nextEmptyRow = row;
      }
    }

    tables.push({ name: label, rowStart: item.rows.start, rowEnd: item.rows.end, cols, nextEmptyRow, existingRows });
  }

  return tables;
}

function getModeInstructions(mode: AiMode, hasTables: boolean): string {
  switch (mode) {
    case 'summarize':
      return `## YOUR TASK: SUMMARIZE

Provide a clear, structured summary of this invoice including:
- Invoice number, date, and title
- Seller (From) and buyer (Bill To) details
- All line items with descriptions and amounts
- Total amount due
- Any notes or additional fields

Be concise and professional. Do NOT output JSON or suggest cell edits.`;

    case 'edit':
      return `## YOUR TASK: EDIT CELLS

Help the user edit invoice cells based on their request.${hasTables ? '\nWhen adding table items, use the "Next empty row" cell references shown above.' : ''}
Output the JSON block FIRST, then a brief explanation.
Include ALL requested changes in a single JSON block — do not split across multiple responses.`;

    case 'analyze':
      return `## YOUR TASK: ANALYZE

Analyze this invoice for potential issues:
- Missing or empty required fields (invoice number, date, billing parties)
- Mathematical errors (item amounts not matching the total)
- Duplicate line items
- Inconsistent, suspicious, or placeholder values (e.g. "[Name]", "0.00" for all items)
- Incomplete table rows (description without amount, or vice versa)

Report each issue clearly with the cell reference. If everything looks correct, say so.
Only output JSON if the user explicitly asks you to apply fixes.`;

    case 'format':
      return `## YOUR TASK: FORMAT

Review all text fields and suggest corrections for:
- Spelling mistakes in names, addresses, and item descriptions
- Inconsistent capitalization (e.g., ALL CAPS where not needed, or inconsistent title casing)
- Extra whitespace, double spaces, or stray punctuation
- Placeholder text that was never filled in (e.g. "[Name]", "N/A")

For each issue found, output the corrected value in JSON format.
Output the JSON block FIRST listing all corrections, then explain each change.`;

    case 'auto':
    default:
      return `## YOUR TASK: AUTO

First, identify what the user is asking for:
- **SUMMARIZE** → asking for an overview or summary
- **EDIT** → asking to change, update, set, add, or fill in values
- **ANALYZE** → asking to check, review, verify, find errors, or validate
- **FORMAT** → asking to fix spelling, casing, or formatting

Then execute the appropriate task.
- For EDIT and FORMAT tasks: output JSON first, then explanation.
- For SUMMARIZE and ANALYZE tasks: use clear, structured plain text.
- Include ALL changes in a single JSON block — do not split across multiple responses.`;
  }
}

export function buildSystemPrompt(
  appMapping: Record<string, Record<string, AppMappingItem>> | undefined,
  sheetId: string,
  mode: AiMode = 'auto',
): string {
  if (!appMapping?.[sheetId]) {
    return `You are an invoice editing assistant. No invoice data is available for sheet "${sheetId}".`;
  }

  const sheetMapping = appMapping[sheetId];
  const sheet = getSheet(sheetId);
  const tables = buildTableData(appMapping, sheetId, sheet);

  // ── Text / form fields ──────────────────────────────────────────────────────
  let fieldLines = '';
  for (const [label, item] of Object.entries(sheetMapping)) {
    if (item.type === 'text' && item.cell) {
      const val = sheet ? cleanValue(readCellValue(sheet, item.cell)) : '';
      const tag = item.editable ? '[editable]' : '[read-only]';
      fieldLines += `${label}: "${val}"  →  cell ${item.cell}  ${tag}\n`;
    } else if (item.type === 'form' && item.formContent) {
      fieldLines += `${label}:\n`;
      for (const [key, subRaw] of Object.entries(item.formContent)) {
        const sub = subRaw as AppMappingItem;
        if (sub.cell) {
          const val = sheet ? cleanValue(readCellValue(sheet, sub.cell)) : '';
          const tag = sub.editable ? '[editable]' : '[read-only]';
          fieldLines += `  ${key}: "${val}"  →  cell ${sub.cell}  ${tag}\n`;
        }
      }
    }
  }

  // ── Table sections ───────────────────────────────────────────────────────────
  let tableLines = '';
  let tableExamples = '';

  for (const t of tables) {
    tableLines += `\n${t.name} (table, rows ${t.rowStart}–${t.rowEnd}):\n`;

    // Always show column → cell mapping
    tableLines += `  Columns:\n`;
    for (const col of t.cols) {
      const tag = col.editable ? '[editable]' : '[read-only]';
      tableLines += `    ${col.label} → column ${col.colLetter}  ${tag}\n`;
    }

    // Next available row
    if (t.nextEmptyRow !== null) {
      const cellList = t.cols
        .filter(c => c.editable)
        .map(c => `${c.colLetter}${t.nextEmptyRow}`)
        .join(', ');
      tableLines += `  Next empty row: ${t.nextEmptyRow}  (editable cells: ${cellList})\n`;
    } else {
      tableLines += `  Table is full — all rows ${t.rowStart}–${t.rowEnd} have content\n`;
    }

    // Existing rows (only non-empty ones)
    if (t.existingRows.length > 0) {
      tableLines += `  Current items:\n`;
      for (const row of t.existingRows) {
        const parts = row.cells
          .map(c => `${c.label}="${c.value}" [${c.cell}${c.editable ? ',editable' : ''}]`)
          .join('  ');
        tableLines += `    Row ${row.rowNum}: ${parts}\n`;
      }
    } else {
      tableLines += `  (no items yet — use row ${t.nextEmptyRow ?? t.rowStart} to add the first one)\n`;
    }

    // Build a table-specific example for the prompt
    const targetRow = t.nextEmptyRow ?? t.existingRows[0]?.rowNum ?? t.rowStart;
    const editableCols = t.cols.filter(c => c.editable);
    if (editableCols.length > 0 && !tableExamples) {
      const actions = editableCols.slice(0, 3).map((c, i) => {
        if (i === 0) return `{"coord":"${c.colLetter}${targetRow}","value":"Sample Description","type":"text"}`;
        return `{"coord":"${c.colLetter}${targetRow}","value":100,"type":"value"}`;
      }).join(',');
      tableExamples = `Add item to ${t.name} (row ${targetRow}):
\`\`\`json
{"actions":[${actions}]}
\`\`\`

Edit existing ${t.name} row ${t.existingRows[0]?.rowNum ?? targetRow}:
\`\`\`json
{"actions":[{"coord":"${editableCols[0].colLetter}${t.existingRows[0]?.rowNum ?? targetRow}","value":"Updated Value","type":"text"}]}
\`\`\``;
    }
  }

  const modeInstructions = getModeInstructions(mode, tables.length > 0);

  // ── Assemble prompt ──────────────────────────────────────────────────────────
  return `You are an AI assistant embedded in an invoice editor. You can read, explain, and edit invoice cells.

## CURRENT INVOICE DATA (${sheetId})

${fieldLines}${tableLines}
## GENERAL RULES

- ONLY edit cells marked [editable]. Never touch [read-only] cells.
- Use the EXACT cell references shown above — do not guess or invent cell addresses.
- Use type "text" for strings, "value" for numbers, "formula" for =SUM(...) etc.
- If a cell is [read-only], explain that to the user instead of editing it.
- NEVER write phrases like "Applied N cell edits successfully" or "edits have been applied" — the system handles confirmation after the user reviews and approves your proposed changes.

## JSON FORMAT (for any cell edits)

\`\`\`json
{"actions":[{"coord":"CELL","value":"VALUE","type":"text|value|formula"}]}
\`\`\`

${tableExamples ? `## TABLE EDIT EXAMPLES\n\n${tableExamples}\n` : ''}
${modeInstructions}`;
}

// ── Legacy exports kept for any callers ─────────────────────────────────────

export function readAllMappedCells(
  appMapping: Record<string, Record<string, AppMappingItem>> | undefined,
  sheetId: string,
) {
  if (!appMapping?.[sheetId]) return [];
  const sheet = getSheet(sheetId);
  return buildTableData(appMapping, sheetId, sheet);
}

export function getNextEmptyTableRow(
  appMapping: Record<string, Record<string, AppMappingItem>> | undefined,
  sheetId: string,
): number | null {
  if (!appMapping?.[sheetId]) return null;
  const sheet = getSheet(sheetId);
  const tables = buildTableData(appMapping, sheetId, sheet);
  return tables[0]?.nextEmptyRow ?? null;
}
