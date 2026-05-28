import type { TicketCategory } from "@/lib/csv/ticketCategoryRanges";
import { normalizeTicketLabel } from "@/lib/csv/normalizeTicketLabel";

/** 受付名（E列）→ カテゴリ。先にマッチしたルールを採用 */
const RECEPTION_RULES: { pattern: RegExp; category: TicketCategory | "skip" }[] = [
  { pattern: /売止/, category: "skip" },
  { pattern: /５００円割引ＩＢ|500.*割引.*IB/i, category: "discount500ib" },
  { pattern: /５００円割引|500.*割引/i, category: "discount500" },
  { pattern: /インバウンド|inbound|in-bound/i, category: "ib" },
  { pattern: /インナー|inner/i, category: "inner" },
  { pattern: /電通|dentsu/i, category: "dentsu" },
  { pattern: /日本旅行|日旅|^NTA$/i, category: "nta" },
  { pattern: /一般発売|入場券/, category: "general" },
];

/** 販売区分（H列）の別名 → カテゴリ内ベース名（normalize 後のキー） */
const TICKET_TYPE_BASE_ALIASES: Record<string, string> = {
  "貸切枠（20名まで）": "貸切",
  "学生19歳以上車いす": "学生車いす（19歳以上）",
  "学生19歳未満車いす": "学生車いす（19歳未満）",
  "アフター5一般": "アフター5（一般）",
  "アフター5こども": "アフター5（こども）",
  "アフター5一般車いす": "アフター5（一般）車いす",
  "アフター5子供車いす": "アフター5（こども）車いす",
};

/** カテゴリ×H列 → Excel 完全ラベル（例外のみ。値は EXCEL_TICKET_LABELS の表記） */
const EXCEL_LABEL_OVERRIDES: Partial<
  Record<TicketCategory, Record<string, string>>
> = {
  general: {
    "アフター5（こども）": "アフター５（こども）車いす",
  },
  ib: {
    貸切: "貸切インバウンド",
    "アフター5（一般）": "IBアフター５（一般）",
    "アフター5（こども）": "IBアフター５（こども）",
    "アフター5（一般）車いす": "IBアフター５（一般）車いす",
    "アフター5（こども）車いす": "IBアフター５（こども）車いす",
  },
  dentsu: {
    貸切: "電通　貸切",
  },
  nta: {
    貸切: "日旅　貸切",
  },
};

const CATEGORY_LABEL_PREFIX: Record<
  Exclude<TicketCategory, "general">,
  string
> = {
  discount500: "【500円割引】",
  ib: "IB　",
  discount500ib: "【500円割引】IB　",
  inner: "インナー　",
  dentsu: "電通　",
  nta: "日旅　",
};

export function categoryFromReceptionName(
  receptionName: string,
): TicketCategory | "skip" | null {
  const rec = normalizeTicketLabel(receptionName);
  if (!rec) return "general";

  for (const rule of RECEPTION_RULES) {
    if (rule.pattern.test(rec)) return rule.category;
  }

  return "general";
}

function canonicalBaseTicketType(ticketType: string): string {
  const typ = normalizeTicketLabel(ticketType);
  return TICKET_TYPE_BASE_ALIASES[typ] ?? typ;
}

function buildExcelLabel(
  category: TicketCategory,
  baseType: string,
): string {
  const override = EXCEL_LABEL_OVERRIDES[category]?.[baseType];
  if (override) return override;

  if (category === "general") return baseType;

  const prefix = CATEGORY_LABEL_PREFIX[category];
  if (baseType.startsWith("【500円割引】")) {
    return baseType;
  }
  return `${prefix}${baseType}`;
}

/**
 * 受付名＋販売区分から実績管理表 B 列ラベル（完全一致用文字列）を組み立てる。
 * マッチ不可の場合は null（売止受付など）。
 */
export function resolveExcelLabel(
  receptionName: string,
  ticketType: string,
): string | null {
  const category = categoryFromReceptionName(receptionName);
  if (category === "skip" || category === null) return null;

  const baseType = canonicalBaseTicketType(ticketType);
  return buildExcelLabel(category, baseType);
}
