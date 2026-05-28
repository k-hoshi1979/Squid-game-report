import { readFileSync } from "fs";
import { parseTicketCsv, type TicketSummaryRow } from "../src/lib/csv/parseTicketCsv";
import { EXCEL_TICKET_LABELS } from "../src/lib/csv/excelExportSpec";
import { mapTicketRowToIndex } from "../src/lib/csv/mapTicketRowToIndex";
import { resolveExcelLabel } from "../src/lib/csv/ticketCsvMapping";

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage: npx tsx scripts/verify-mapping.ts <ticket.csv>");
  process.exit(1);
}

const buf = readFileSync(csvPath);
const text = new TextDecoder("shift_jis").decode(buf);
const parsed = parseTicketCsv(text);
const counts = Array<number>(EXCEL_TICKET_LABELS.length).fill(0);
const unmapped: TicketSummaryRow[] = [];

for (const row of parsed.rows) {
  const idx = mapTicketRowToIndex(row.receptionName, row.ticketType);
  if (idx >= 0) counts[idx] += row.count;
  else unmapped.push(row);
}

console.log("=== Key rows ===");
for (const label of [
  "貸切",
  "アフター５（一般）",
  "アフター５（一般）車いす",
  "アフター５（こども）車いす",
  "貸切インバウンド",
  "IBアフター５（一般）",
  "電通　貸切",
]) {
  const idx = EXCEL_TICKET_LABELS.indexOf(label);
  console.log(label, counts[idx] ?? 0);
}

console.log("\n=== Unmapped (count>0) ===");
for (const row of unmapped) {
  console.log(row.count, row.receptionName, "|", row.ticketType, "→", resolveExcelLabel(row.receptionName, row.ticketType));
}
