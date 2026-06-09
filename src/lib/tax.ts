/** 税込金額から税抜金額を算出（消費税10%・端数切り捨て） */
export function taxExFromTaxIn(taxIn: number): number {
  if (!Number.isFinite(taxIn) || taxIn <= 0) return 0;
  return Math.floor(taxIn / 1.1);
}

/** リテール売上の税抜金額（手入力税抜を優先、未入力時は税込から算出） */
export function retailSalesTaxEx(
  salesTaxEx: number,
  salesTaxIn: number,
): number {
  const ex = Number(salesTaxEx);
  if (Number.isFinite(ex) && ex > 0) return Math.floor(ex);
  return taxExFromTaxIn(salesTaxIn);
}

/**
 * チケット売上を除くMD売上（税抜）
 * リテール売上合計（税抜）− IBチケット対応合計（税抜）
 */
export function retailMdSalesExcludingIbTickets(
  salesTaxEx: number,
  salesTaxIn: number,
  ibTotalAmount: number,
): number {
  return retailSalesTaxEx(salesTaxEx, salesTaxIn) - taxExFromTaxIn(ibTotalAmount);
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
