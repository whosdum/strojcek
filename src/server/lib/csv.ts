/**
 * Minimal CSV serializer tuned for opening in Slovak Excel:
 *  - `;` delimiter (Excel sk-SK uses the semicolon as the list separator,
 *    and the comma as the decimal separator)
 *  - UTF-8 BOM prepended so diacritics (č, š, ž) render correctly on first open
 *  - CRLF line endings
 *
 * No external dependency — escaping is RFC-4180 style: any cell containing the
 * delimiter, a double quote, CR or LF is wrapped in double quotes and inner
 * quotes are doubled.
 */
const DELIMITER = ";";
const BOM = "﻿";

// Cells starting with one of these are treated as a formula by Excel / Google
// Sheets / LibreOffice (CSV/formula injection). Customer name & notes come from
// the PUBLIC booking form and are stored verbatim, so an anonymous booker could
// otherwise plant =HYPERLINK(...)/DDE payloads that execute when the admin opens
// the export.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  // Prefix a single quote to force text — the OWASP-recommended defang. The
  // apostrophe shows only in the formula bar, not the rendered cell.
  const defanged = FORMULA_TRIGGER.test(s) ? `'${s}` : s;
  if (
    defanged !== s ||
    defanged.includes(DELIMITER) ||
    defanged.includes('"') ||
    defanged.includes("\n") ||
    defanged.includes("\r")
  ) {
    return `"${defanged.replace(/"/g, '""')}"`;
  }
  return defanged;
}

/**
 * Build a CSV document from a header row and data rows. Always emits the
 * header even when `rows` is empty, so the user still gets a valid file.
 */
export function buildCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  const lines = [headers.map(escapeCell).join(DELIMITER)];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(DELIMITER));
  }
  return BOM + lines.join("\r\n");
}
