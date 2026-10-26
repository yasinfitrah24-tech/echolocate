// Font definitions, loaded once (Next.js "font definitions file"). Both fonts
// are self-hosted from Fontsource packages (SIL Open Font License), so nothing
// is fetched from Google Fonts.
//
// - Bricolage Grotesque, variable (weight 200-800, width 75-100%): headings,
//   the wordmark, card titles and the line-up, through the font-display utility.
// - Atkinson Hyperlegible 400 and 700: body text, made for easy reading.

import localFont from "next/font/local";

export const bricolage = localFont({
  src: "../../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wdth-normal.woff2",
  weight: "200 800",
  style: "normal",
  display: "swap",
  variable: "--font-bricolage",
  declarations: [{ prop: "font-stretch", value: "75% 100%" }],
  fallback: ["Arial Narrow", "Arial", "sans-serif"],
});

export const atkinson = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-atkinson",
  fallback: ["system-ui", "Arial", "sans-serif"],
});
