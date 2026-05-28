import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import {
  fmtCount,
  fmtYen,
  type MallProExportData,
  type MallProPurchaseRow,
} from "@/lib/export-data/mallProData";

/** PDF 上部に表示するタイトル */
export const MALL_PRO_PDF_TITLE = "渋谷リアルイカゲーム　チケット販売";

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingHorizontal: 48,
    paddingBottom: 48,
    fontFamily: "NotoSansJP",
    fontSize: 11,
    color: "#111827",
  },
  title: {
    fontSize: 18,
    marginBottom: 28,
    fontWeight: 700,
  },
  dateBlock: {
    marginBottom: 32,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
  },
  dateLabel: {
    fontSize: 13,
    color: "#374151",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 12,
    color: "#1f2937",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  rowLabel: {
    fontSize: 11,
    width: "40%",
  },
  rowValue: {
    fontSize: 11,
    width: "60%",
    textAlign: "right",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 2,
    borderTopColor: "#374151",
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: 700,
  },
  totalValue: {
    fontSize: 13,
    fontWeight: 700,
  },
});

function PurchaseRow({
  label,
  row,
}: {
  label: string;
  row: MallProPurchaseRow;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>
        {fmtCount(row.count)}枚{"  "}¥{fmtYen(row.amount)}
      </Text>
    </View>
  );
}

export function MallProDocument({ data }: { data: MallProExportData }) {
  return (
    <Document title={`${MALL_PRO_PDF_TITLE}_${data.reportDate}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{MALL_PRO_PDF_TITLE}</Text>

        <View style={styles.dateBlock}>
          <Text style={styles.dateLabel}>日付：{data.reportDateLabel}</Text>
        </View>

        <Text style={styles.sectionTitle}>チケット売上</Text>
        <PurchaseRow label="チケット購入" row={data.ticketPurchase} />
        <PurchaseRow label="特典購入" row={data.tokutenPurchase} />
        <PurchaseRow label="VIP購入" row={data.vipPurchase} />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>売上合計（税抜）</Text>
          <Text style={styles.totalValue}>¥{fmtYen(data.totalTaxEx)}</Text>
        </View>
      </Page>
    </Document>
  );
}
