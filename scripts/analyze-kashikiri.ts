import { readFileSync } from "fs";
import { parseTicketCsv } from "../src/lib/csv/parseTicketCsv";
import { EXCEL_TICKET_LABELS } from "../src/lib/csv/excelExportSpec";
import { mapTicketRowToIndex } from "../src/lib/csv/mapTicketRowToIndex";

const csvPath = process.argv[2]!;
const buf = readFileSync(csvPath);
const text = new TextDecoder("shift_jis").decode(buf);
const parsed = parseTicketCsv(text);

console.log("=== All kashikiri-related rows in CSV ===");
for (const r of parsed.rows) {
  if (!r.ticketType.includes("貸切") && !r.ticketType.includes("枠")) continue;
  const idx = mapTicketRowToIndex(r.receptionName, r.ticketType);
  const label = idx >= 0 ? EXCEL_TICKET_LABELS[idx] : "UNMAPPED";
  console.log(r.count, "|", r.receptionName, "|", r.ticketType, "->", label);
}

console.log("\n=== Sum by mapped label (kashikiri/after5) ===");
const sums = new Map<string, number>();
for (const r of parsed.rows) {
  const idx = mapTicketRowToIndex(r.receptionName, r.ticketType);
  if (idx < 0) continue;
  const label = EXCEL_TICKET_LABELS[idx];
  sums.set(label, (sums.get(label) ?? 0) + r.count);
}
for (const [k, v] of sums) {
  if (k.includes("貸切") || k.includes("アフター")) console.log(k, v);
}
console.log("Total count", parsed.totalCount);
