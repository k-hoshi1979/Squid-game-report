import { renderToBuffer } from "@react-pdf/renderer";
import { MallProDocument } from "@/lib/export-data/MallProDocument";
import type { MallProExportData } from "@/lib/export-data/mallProData";
import { registerJapaneseFont } from "@/lib/export-data/registerJapaneseFont";

export async function buildMallProPdf(data: MallProExportData): Promise<Buffer> {
  registerJapaneseFont();
  const buffer = await renderToBuffer(<MallProDocument data={data} />);
  return Buffer.from(buffer);
}
