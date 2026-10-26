// Font definitions, loaded once and imported where needed (Next.js "font
// definitions file"). Archivo is self-hosted from @fontsource-variable/archivo
// (SIL Open Font License), so nothing is fetched from Google Fonts.
//
// One variable file covers weight 100-900 and width 62-125%: headings and the
// wordmark use the condensed width (font-stretch: 75%), body text the normal one.

import localFont from "next/font/local";

export const archivo = localFont({
  src: "../../node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-archivo",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
  fallback: ["Arial Narrow", "Arial", "sans-serif"],
});
