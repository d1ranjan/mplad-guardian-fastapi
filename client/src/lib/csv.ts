import type { CsvProjectRow } from "../../../shared/audit";

function parseLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]!;
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) { values.push(current.trim()); current = ""; }
    else current += character;
  }
  values.push(current.trim());
  return values;
}

export function parseProjectCsv(content: string): { headers: string[]; rows: CsvProjectRow[] } {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = parseLine(lines[0]!).map(header => header.trim());
  const rows = lines.slice(1).map(line => {
    const cells = parseLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])) as CsvProjectRow;
  });
  return { headers, rows };
}
