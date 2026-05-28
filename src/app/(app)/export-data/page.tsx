import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { ExportDataMenuCard } from "@/components/export-data/ExportDataMenuCard";
import { EXPORT_DATA_MENUS } from "@/lib/export-data/menus";

export const metadata: Metadata = { title: "報告用データ" };

export default function ExportDataPage() {
  return (
    <>
      <Header
        title="報告用データ"
        description="日報データを基に、報告用のPDFをダウンロードできます"
      />

      <main className="flex-1 p-3 sm:p-6">
        <div className="max-w-3xl space-y-4">
          {EXPORT_DATA_MENUS.map((menu, index) => (
            <ExportDataMenuCard key={menu.id} menu={menu} index={index + 1} />
          ))}
        </div>
      </main>
    </>
  );
}
