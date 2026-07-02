/** 実績管理表 May_ シート B21 起点の項目（Excel と同順・81項目） */
const TICKET_LABELS_B21_B100: readonly string[] = [
  "一般（１９歳以上）",
  "こども（１９歳未満）",
  "ＶＩＰ一般",
  "ＶＩＰこども",
  "一般車いす",
  "こども車いす",
  "ＶＩＰ一般車いす",
  "ＶＩＰこども車いす",
  "ペア（２枚セット）",
  "家族（大人２子供２）",
  "学生（１９歳未満）",
  "学生（１９歳以上）",
  "学生車いす（１９歳未満）",
  "学生車いす（１９歳以上）",
  "貸切",
  "アフター５（一般）",
  "アフター５（こども）車いす",
  "アフター５（一般）車いす",
  "アフター５（こども）車いす",
  "【500円割引】一般（１９歳以上）",
  "【500円割引】こども（１９歳未満）",
  "【500円割引】ＶＩＰ一般",
  "【500円割引】ＶＩＰこども",
  "【500円割引】一般車いす",
  "【500円割引】こども車いす",
  "【500円割引】ＶＩＰ一般車いす",
  "【500円割引】ＶＩＰこども車いす",
  "特別プラン",
  "IB　一般（１９歳以上）",
  "IB　こども（１９歳未満）",
  "IB　ＶＩＰ一般",
  "IB　ＶＩＰこども",
  "IB　一般車いす",
  "IB　こども車いす",
  "IB　ＶＩＰ一般車いす",
  "IB　ＶＩＰこども車いす",
  "IB　ペア（２枚セット）",
  "IB　家族（大人２子供２）",
  "IB　学生（１９歳未満）",
  "IB　学生（１９歳以上）",
  "IB　学生車いす（１９歳未満）",
  "IB　学生車いす（１９歳以上）",
  "貸切インバウンド",
  "IBアフター５（一般）",
  "IBアフター５（こども）",
  "IBアフター５（一般）車いす",
  "IBアフター５（こども）車いす",
  "【500円割引】IB　一般（１９歳以上）",
  "【500円割引】IB　こども（１９歳未満）",
  "【500円割引】IB　ＶＩＰ一般",
  "【500円割引】IB　ＶＩＰこども",
  "【500円割引】IB　一般車いす",
  "【500円割引】IB　こども車いす",
  "【500円割引】IB　ＶＩＰ一般車いす",
  "【500円割引】IB　ＶＩＰこども車いす",
  "インナー　一般（１９歳以上）",
  "インナー　こども（１９歳未満）",
  "インナー　ＶＩＰ一般",
  "インナー　ＶＩＰこども",
  "インナー　一般車いす",
  "インナー　こども車いす",
  "インナー　ＶＩＰ一般車いす",
  "インナー　ＶＩＰこども車いす",
  "電通　一般（１９歳以上）",
  "電通　こども（１９歳未満）",
  "電通　ＶＩＰ一般",
  "電通　ＶＩＰこども",
  "電通　一般車いす",
  "電通　こども車いす",
  "電通　ＶＩＰ一般車いす",
  "電通　ＶＩＰこども車いす",
  "電通　貸切",
  "日旅　一般（１９歳以上）",
  "日旅　こども（１９歳未満）",
  "日旅　ＶＩＰ一般",
  "日旅　ＶＩＰこども",
  "日旅　一般車いす",
  "日旅　こども車いす",
  "日旅　ＶＩＰ一般車いす",
  "日旅　ＶＩＰこども車いす",
  "日旅　貸切",
] as const;

/**
 * ★売止用受付 → 実績管理表の売止ブロック（一般と同型19項目・B106 付近）
 * 販売区分（H列）は一般発売と同じ名称を使用
 */
export const URIDOME_TICKET_LABELS: readonly string[] = TICKET_LABELS_B21_B100.slice(
  0,
  19,
).map((label) => `売止　${label}`);

/** チケット集計・項目一覧・CSV出力で使う全ラベル（81 + 売止19） */
export const EXCEL_TICKET_LABELS: readonly string[] = [
  ...TICKET_LABELS_B21_B100,
  ...URIDOME_TICKET_LABELS,
];

/** 日報手入力（チケットCSV以外）。売止ブロック末尾とリテール売上の間 */
export const TICKET_SUPPLEMENT_LABELS = ["特典", "貸切VIP"] as const;

/** 実績管理表 CSV ダウンロード用チケット販売ブロック（売止末尾の直後に特典・貸切VIP） */
export const TICKET_EXPORT_LABELS: readonly string[] = [
  ...EXCEL_TICKET_LABELS,
  ...TICKET_SUPPLEMENT_LABELS,
];

export interface AppendExportField {
  header: string;
  section: string;
}

export const RETAIL_EXPORT_FIELDS: AppendExportField[] = [
  { section: "■リテール売上", header: "物販売上（税抜）" },
  { section: "■リテール売上", header: "物販売上（税込）" },
  { section: "■リテール売上", header: "決済件数" },
  { section: "■リテール売上", header: "チケット売上を除くMD売上（税抜）" },
];

export const JERSEY_EXPORT_FIELDS: AppendExportField[] = [
  { section: "■ジャージレンタル", header: "ジャージレンタル通常" },
  { section: "■ジャージレンタル", header: "ジャージレンタルSNS" },
  { section: "■ジャージレンタル", header: "レンタル合計" },
];

export const IB_EXPORT_FIELDS: AppendExportField[] = [
  { section: "■IB対応チケット", header: "一般（平日）" },
  { section: "■IB対応チケット", header: "一般（休日）" },
  { section: "■IB対応チケット", header: "こども（平日）" },
  { section: "■IB対応チケット", header: "こども（休日）" },
  { section: "■IB対応チケット", header: "一般VIP（平日）" },
  { section: "■IB対応チケット", header: "一般VIP（休日）" },
  { section: "■IB対応チケット", header: "こどもVIP（平日）" },
  { section: "■IB対応チケット", header: "こどもVIP（休日）" },
  { section: "■IB対応チケット", header: "【500円引き】一般（平日）" },
  { section: "■IB対応チケット", header: "【500円引き】一般（休日）" },
  { section: "■IB対応チケット", header: "【500円引き】こども（平日）" },
  { section: "■IB対応チケット", header: "【500円引き】こども（休日）" },
  { section: "■IB対応チケット", header: "【500円引き】一般VIP（平日）" },
  { section: "■IB対応チケット", header: "【500円引き】一般VIP（休日）" },
  { section: "■IB対応チケット", header: "【500円引き】こどもVIP（平日）" },
  { section: "■IB対応チケット", header: "【500円引き】こどもVIP（休日）" },
  { section: "■IB対応チケット", header: "貸切VIP" },
  { section: "■IB対応チケット", header: "IB合計枚数" },
  { section: "■IB対応チケット", header: "IB合計金額" },
];

/** appendValues 組み立て順（項目一覧等で参照） */
export const APPEND_EXPORT_FIELDS: AppendExportField[] = [
  ...RETAIL_EXPORT_FIELDS,
  ...JERSEY_EXPORT_FIELDS,
  ...IB_EXPORT_FIELDS,
];

export const RETAIL_EXPORT_FIELD_COUNT = RETAIL_EXPORT_FIELDS.length;
export const JERSEY_EXPORT_FIELD_COUNT = JERSEY_EXPORT_FIELDS.length;

/** 実績管理表 CSV のセクション見出し（チケット販売ブロック） */
export const TICKET_SALES_EXPORT_SECTION = "■チケット売上" as const;

export const EXCEL_TICKET_ROW_START = 21;
