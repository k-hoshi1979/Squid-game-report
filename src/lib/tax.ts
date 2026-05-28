/** 税込金額から税抜金額を算出（消費税10%・端数切り捨て） */
export function taxExFromTaxIn(taxIn: number): number {
  if (!Number.isFinite(taxIn) || taxIn <= 0) return 0;
  return Math.floor(taxIn / 1.1);
}

/** チケット売上合計の税抜金額（保存値より税込から再計算を優先） */
export function ticketTotalTaxEx(
  ticketTotal: { amountTaxIn?: number; amountTaxEx?: number } | undefined | null,
): number {
  const taxIn = ticketTotal?.amountTaxIn;
  if (taxIn != null && Number.isFinite(taxIn)) {
    return taxExFromTaxIn(taxIn);
  }
  const stored = Number(ticketTotal?.amountTaxEx);
  if (!Number.isFinite(stored) || stored <= 0) return 0;
  return Math.floor(stored);
}
