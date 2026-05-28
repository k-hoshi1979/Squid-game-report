export interface ExportDataMenu {
  id: string;
  title: string;
  description: string;
  apiPath: string;
}

/** 報告用データのメニュー定義（今後ここに追加） */
export const EXPORT_DATA_MENUS: readonly ExportDataMenu[] = [
  {
    id: "mall-pro",
    title: "モールプロ添付",
    description:
      "選択した日のチケット売上（チケット購入・特典購入・VIP購入・売上合計）を税抜金額で1枚のPDFに出力します。",
    apiPath: "/api/export-data/mall-pro",
  },
];
