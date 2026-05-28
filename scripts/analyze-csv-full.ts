import { readFileSync } from "fs";
import { parseTicketCsv } from "../src/lib/csv/parseTicketCsv";
import { EXCEL_TICKET_LABELS } from "../src/lib/csv/excelExportSpec";
import { mapTicketRowToIndex } from "../src/lib/csv/mapTicketRowToIndex";
import { resolveExcelLabel } from "../src/lib/csv/ticketCsvMapping";

const csvPath = process.argv[2]!;
const buf = readFileSync(csvPath);
const text = new TextDecoder("shift_jis").decode(buf);
const parsed = parseTicketCsv(text);

console.log("=== Full row dump (count>0) ===");
for (const r of parsed.rows) {
  const idx = mapTicketRowToIndex(r.receptionName, r.ticketType);
  const label = idx >= 0 ? EXCEL_TICKET_LABELS[idx] : "UNMAPPED";
  console.log(
    String(r.count).padStart(4),
    "|",
    r.receptionName.padEnd(20),
    "|",
    r.ticketType,
    "->",
    label,
  );
}

console.log("\n=== Unmapped ===");
for (const r of parsed.rows) {
  if (mapTicketRowToIndex(r.receptionName, r.ticketType) >= 0) continue;
  console.log(r.count, r.receptionName, "|", r.ticketType);
}

console.log("\n=== All mapped sums (non-zero) ===");
const counts = Array<number>(EXCEL_TICKET_LABELS.length).fill(0);
for (const r of parsed.rows) {
  const idx = mapTicketRowToIndex(r.receptionName, r.ticketType);
  if (idx >= 0) counts[idx] += r.count;
}
for (let i = 0; i < EXCEL_TICKET_LABELS.length; i++) {
  if (counts[i] > 0) console.log(counts[i], EXCEL_TICKET_LABELS[i]);
}
console.log("Sum mapped", counts.reduce((a, b) => a + b, 0));
console.log("CSV total", parsed.totalCount);
