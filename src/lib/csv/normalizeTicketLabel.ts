/** 販売区分名の表記ゆれを吸収（全角数字・スペース・VIP表記など） */
export function normalizeTicketLabel(s: string): string {
  return s
    .trim()
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0),
    )
    .replace(/VIP/gi, "ＶＩＰ");
}
