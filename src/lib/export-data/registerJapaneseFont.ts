import { Font } from "@react-pdf/renderer";

let registered = false;

/** PDF 用日本語フォント（初回のみ登録） */
export function registerJapaneseFont(): void {
  if (registered) return;
  Font.register({
    family: "NotoSansJP",
    src: "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/SubsetOTF/JP/NotoSansJP-Regular.otf",
  });
  registered = true;
}
