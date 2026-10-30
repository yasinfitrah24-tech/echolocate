// The one-page sponsor sheet as a real PDF, drawn in the browser, in the
// site's "Soundcheck" style: a sun-yellow header with echo rings, ink
// outlines, pale yellow taste box and a tangerine call to action.
// @react-pdf/renderer is large, so this module is only loaded with import()
// when someone clicks "Download PDF".
//
// Fonts are static WOFF files in public/fonts (react-pdf cannot use variable
// fonts): Bricolage Grotesque 800 for headings, Atkinson Hyperlegible for text.

import {
  Circle,
  ClipPath,
  Defs,
  Document,
  Font,
  G,
  Page,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
  pdf,
  type Styles,
} from "@react-pdf/renderer";
import { pdfSafe, type OnePager } from "@/lib/one-pager";

const C = {
  paper: "#fffbf5",
  card: "#ffffff",
  ink: "#1e1430",
  ink2: "#4a3f57",
  ink3: "#6b6177",
  line: "#eadfd3",
  field: "#8a8094",
  accent: "#ff5a1f",
  tint: "#ffeaa8",
  sun: "#ffc83d",
};

const DISPLAY = "Bricolage";
const BODY = "Atkinson";

let fontsReady = false;

/** Registers the fonts once, from the site's own origin. */
function registerFonts() {
  if (fontsReady) return;
  const base = typeof window === "undefined" ? "" : window.location.origin;
  Font.register({ family: DISPLAY, src: `${base}/fonts/bricolage-grotesque-latin-800-normal.woff`, fontWeight: 800 });
  Font.register({
    family: BODY,
    fonts: [
      { src: `${base}/fonts/atkinson-hyperlegible-latin-400-normal.woff`, fontWeight: 400 },
      { src: `${base}/fonts/atkinson-hyperlegible-latin-700-normal.woff`, fontWeight: 700 },
    ],
  });
  // Whole words only: no hyphens in names and amounts.
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
}

/** Usable width of the page: page width minus 2 x 24 pt padding. */
const CONTENT_WIDTH = { LETTER: 612 - 48, A4: 595 - 48 } as const;
const HEADER_HEIGHT = 100;

const styles = StyleSheet.create({
  page: {
    padding: 24,
    backgroundColor: C.paper,
    fontFamily: BODY,
    fontSize: 8.5,
    color: C.ink,
    lineHeight: 1.35,
  },
  header: {
    height: HEADER_HEIGHT,
    backgroundColor: C.sun,
    borderWidth: 2,
    borderColor: C.ink,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  wordRow: { flexDirection: "row", alignItems: "flex-end" },
  word: { fontFamily: DISPLAY, fontWeight: 800, fontSize: 15, lineHeight: 1 },
  eyebrow: { fontWeight: 700, fontSize: 7, letterSpacing: 1.2, marginLeft: 10, marginBottom: 1.5 },
  title: { fontFamily: DISPLAY, fontWeight: 800, fontSize: 19, lineHeight: 1.05, marginTop: 8, maxWidth: "72%" },
  subtitle: { fontWeight: 700, fontSize: 9, marginTop: 5 },
  row: { flexDirection: "row", gap: 10, marginTop: 8 },
  card: { borderWidth: 1.5, borderColor: C.ink, borderRadius: 10, backgroundColor: C.card, padding: 9 },
  cardTitle: { fontFamily: DISPLAY, fontWeight: 800, fontSize: 11.5, lineHeight: 1.1, marginBottom: 6 },
  sectionTitle: { fontFamily: DISPLAY, fontWeight: 800, fontSize: 11.5, lineHeight: 1.1, marginTop: 9, marginBottom: 5 },
  bold: { fontWeight: 700 },
  small: { fontSize: 7, color: C.ink3, marginTop: 5 },
  scoreRow: { flexDirection: "row", gap: 9 },
  badge: { width: 40, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: DISPLAY, fontWeight: 800, fontSize: 17, lineHeight: 1 },
  // A View around the text: padding on a react-pdf Text box sits unevenly,
  // so the pill is centered here instead.
  pill: {
    alignSelf: "flex-start",
    backgroundColor: C.sun,
    borderWidth: 1,
    borderColor: C.ink,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingTop: 1,
    paddingBottom: 2.5,
    marginTop: 3,
    marginBottom: 3,
  },
  pillText: { fontSize: 6.5, fontWeight: 700, lineHeight: 1 },
  checks: { flexDirection: "row", flexWrap: "wrap", rowGap: 5 },
  check: { width: "50%", flexDirection: "row", gap: 5, paddingRight: 6 },
  kv: { flexDirection: "row", paddingVertical: 2.2, borderBottomWidth: 0.75, borderBottomColor: C.line },
  kvLabel: { width: 58, color: C.ink3 },
  kvValue: { flex: 1 },
  taste: { backgroundColor: C.tint, borderRadius: 10, padding: 9 },
  tasteLabel: { fontSize: 6.5, fontWeight: 700, letterSpacing: 1, color: C.ink2, marginTop: 5 },
  bulletRow: { flexDirection: "row", gap: 5, marginTop: 1.8 },
  dot: { width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: C.accent, marginTop: 3.4 },
  question: { flex: 1, borderWidth: 1, borderColor: C.ink, borderRadius: 8, backgroundColor: C.card, padding: 7 },
  option: { flex: 1, borderWidth: 1.5, borderColor: C.ink, borderRadius: 10, backgroundColor: C.card, padding: 8 },
  amount: { fontFamily: DISPLAY, fontWeight: 800, fontSize: 15, lineHeight: 1.1, marginTop: 2, marginBottom: 1 },
  cta: {
    backgroundColor: C.accent,
    borderWidth: 1.5,
    borderColor: C.ink,
    borderRadius: 10,
    padding: 10,
  },
  ctaTitle: { fontFamily: DISPLAY, fontWeight: 800, fontSize: 12.5, lineHeight: 1.1, marginBottom: 5 },
  footer: { marginTop: "auto", borderTopWidth: 0.75, borderTopColor: C.line, paddingTop: 5, fontSize: 7, color: C.ink3 },
});

type Style = Styles[string] | Styles[string][];

/** Every string goes through pdfSafe so the fonts can print it. */
function T({ children, style }: { children: string; style?: Style }) {
  return <Text style={style}>{pdfSafe(children)}</Text>;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <>
      {items.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <View style={styles.dot} />
          <T style={{ flex: 1 }}>{item}</T>
        </View>
      ))}
    </>
  );
}

/** A box with a hard ink shadow 3 pt down and right, like the site's main button. */
function HardShadow({ children, style }: { children: React.ReactNode; style?: Style }) {
  return (
    <View style={[{ position: "relative" }, ...(Array.isArray(style) ? style : style ? [style] : [])]}>
      <View
        style={{ position: "absolute", top: 3, left: 3, right: -3, bottom: -3, backgroundColor: C.ink, borderRadius: 10 }}
      />
      {children}
    </View>
  );
}

/** The ring mark of the logo, sized for the wordmark. */
function Ring({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" style={{ marginHorizontal: 0.5, marginBottom: 1 }}>
      <Circle cx="24" cy="24" r="19" fill="none" stroke={C.accent} strokeWidth={10} />
      <Circle cx="24" cy="24" r="5.5" fill={C.ink} />
    </Svg>
  );
}

/** Echo rings in the top right of the header, clipped to its rounded box. */
function HeaderRings({ width }: { width: number }) {
  const w = width - 4;
  const h = HEADER_HEIGHT - 4;
  const cx = w - 78;
  const cy = h - 10;
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", top: 0, left: 0 }}>
      <Defs>
        <ClipPath id="header">
          <Rect x="0" y="0" width={w} height={h} rx="12" ry="12" />
        </ClipPath>
      </Defs>
      <G clipPath="url(#header)">
        <Circle cx={cx} cy={cy} r="92" fill="none" stroke={C.accent} strokeWidth={18} strokeOpacity={0.45} />
        <Circle cx={cx} cy={cy} r="64" fill="none" stroke={C.accent} strokeWidth={14} strokeOpacity={0.7} />
        <Circle cx={cx} cy={cy} r="40" fill="none" stroke={C.accent} strokeWidth={11} />
        <Circle cx={cx} cy={cy} r="15" fill={C.ink} />
      </G>
    </Svg>
  );
}

function CheckMark() {
  return (
    <Svg width={11} height={11} viewBox="0 0 16 16">
      <Circle cx="8" cy="8" r="7" fill={C.accent} stroke={C.ink} strokeWidth={1.4} />
      <Path d="M4.6 8.3l2.2 2.2 4.4-4.9" fill="none" stroke={C.ink} strokeWidth={1.6} />
    </Svg>
  );
}

function ScoreBadge({ score, best }: { score: number | null; best: boolean }) {
  if (score === null) {
    return (
      <View style={[styles.badge, { borderWidth: 1, borderStyle: "dashed", borderColor: C.field }]}>
        <Text style={[styles.badgeText, { color: C.ink3 }]}>-</Text>
      </View>
    );
  }
  if (!best) {
    return (
      <View style={[styles.badge, { backgroundColor: C.tint }]}>
        <Text style={styles.badgeText}>{String(score)}</Text>
      </View>
    );
  }
  return (
    <View style={{ position: "relative", width: 43, height: 43 }}>
      <View style={[styles.badge, { position: "absolute", top: 3, left: 3, backgroundColor: C.ink }]} />
      <View style={[styles.badge, { backgroundColor: C.sun, borderWidth: 1.5, borderColor: C.ink }]}>
        <Text style={styles.badgeText}>{String(score)}</Text>
      </View>
    </View>
  );
}

/** "#29 of 46 brands …" with the rank in bold. */
function Reason({ text }: { text: string }) {
  const match = /^(#\d+)([\s\S]*)$/.exec(pdfSafe(text));
  if (!match) return <T>{text}</T>;
  return (
    <Text>
      <Text style={styles.bold}>{match[1]}</Text>
      {match[2]}
    </Text>
  );
}

export function OnePagerDocument({ sheet }: { sheet: OnePager }) {
  registerFonts();
  const width = CONTENT_WIDTH[sheet.paper];
  return (
    <Document title={pdfSafe(sheet.title)} author="Echolocate" subject="Sponsorship one-pager">
      <Page size={sheet.paper} style={styles.page}>
        <View style={styles.header}>
          <HeaderRings width={width} />
          <View style={styles.wordRow}>
            <Text style={styles.word}>Echol</Text>
            <Ring size={10} />
            <Text style={styles.word}>cate</Text>
            <Text style={styles.eyebrow}>SPONSORSHIP ONE-PAGER</Text>
          </View>
          <T style={styles.title}>{sheet.title}</T>
          <T style={styles.subtitle}>{`Prepared for ${sheet.brandName} · ${sheet.categoryLabel}`}</T>
        </View>

        <View style={styles.row}>
          <View style={[styles.card, { flex: 1.25 }]}>
            <T style={styles.cardTitle}>{sheet.whyHeading}</T>
            <View style={styles.scoreRow}>
              <ScoreBadge score={sheet.fitScore} best={sheet.bestInSearch} />
              <View style={{ flex: 1 }}>
                <T style={styles.bold}>
                  {sheet.fitScore !== null ? "Sponsor Fit Score (out of 100)" : "No score: Qloo has little taste data here"}
                </T>
                {sheet.bestInSearch && (
                  <View style={styles.pill}>
                    <T style={styles.pillText}>Best fit in this search</T>
                  </View>
                )}
                <Reason text={sheet.reasonText} />
              </View>
            </View>
            {sheet.scoreNote && <T style={styles.small}>{sheet.scoreNote}</T>}
          </View>

          {sheet.confirmed.length > 0 && (
            <View style={[styles.card, { flex: 1 }]}>
              <T style={styles.cardTitle}>Confirmed so far</T>
              <View style={styles.checks}>
                {sheet.confirmed.map((item) => (
                  <View key={item} style={styles.check}>
                    <CheckMark />
                    <T style={{ flex: 1 }}>{item}</T>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        <View style={[styles.row, { alignItems: "flex-start" }]}>
          <View style={{ flex: 1 }}>
            <T style={[styles.cardTitle, { marginBottom: 4 }]}>The event</T>
            <View style={{ borderTopWidth: 1.2, borderTopColor: C.ink }}>
              {sheet.event.map((item, index) => (
                <View key={item.label} style={styles.kv}>
                  <T style={styles.kvLabel}>{item.label}</T>
                  <T style={index === 0 ? [styles.kvValue, styles.bold] : styles.kvValue}>{item.value}</T>
                </View>
              ))}
            </View>
            {sheet.cityNote && <T style={styles.small}>{sheet.cityNote}</T>}
          </View>

          <View style={[styles.taste, { flex: 1 }]}>
            <T style={[styles.cardTitle, { marginBottom: 0 }]}>{sheet.profileHeading}</T>
            <T style={styles.tasteLabel}>{sheet.music.label.toUpperCase()}</T>
            <T style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 10.5, marginTop: 1 }}>{sheet.music.value}</T>
            {sheet.alsoLikes.length > 0 && (
              <>
                <T style={styles.tasteLabel}>FANS ALSO LIKE</T>
                <T>{sheet.alsoLikes.join(", ")}</T>
              </>
            )}
            {sheet.similarBrands.length > 0 && (
              <>
                <T style={styles.tasteLabel}>{sheet.similarLabel.toUpperCase()}</T>
                <T>{sheet.similarBrands.join(", ")}</T>
              </>
            )}
          </View>
        </View>

        <T style={styles.sectionTitle}>Your questions, answered</T>
        <View style={{ flexDirection: "row", gap: 7 }}>
          {sheet.questions.map((item) => (
            <View key={item.question} style={styles.question}>
              <T style={styles.bold}>{item.question}</T>
              <Bullets items={item.answer} />
            </View>
          ))}
        </View>

        <T style={styles.sectionTitle}>Ways to take part</T>
        <View style={{ flexDirection: "row", gap: 9 }}>
          {sheet.options.map((option) => (
            <View key={option.label} style={styles.option}>
              <T style={styles.bold}>{option.label}</T>
              <T style={styles.amount}>{option.amount}</T>
              <T style={{ color: C.ink2 }}>{option.detail}</T>
            </View>
          ))}
        </View>
        {sheet.exclusivity && <T style={[styles.bold, { marginTop: 5 }]}>{sheet.exclusivity}</T>}

        <View style={[styles.row, { marginTop: 2, alignItems: "flex-start" }]}>
          <View style={{ flex: 1.2 }}>
            <T style={styles.sectionTitle}>How you measure results</T>
            <Bullets items={sheet.measure} />
          </View>
          <HardShadow style={{ flex: 1, marginTop: 9 }}>
            <View style={styles.cta}>
              <T style={styles.ctaTitle}>{sheet.ask}</T>
              {sheet.contact.map((item, index) => (
                <T key={item} style={index === 0 ? styles.bold : undefined}>
                  {item}
                </T>
              ))}
            </View>
          </HardShadow>
        </View>

        <T style={styles.footer}>{sheet.footer}</T>
      </Page>
    </Document>
  );
}

/** Draws the PDF and hands it to the browser as a download. */
export async function downloadOnePager(sheet: OnePager, fileName: string): Promise<void> {
  const blob = await pdf(<OnePagerDocument sheet={sheet} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before freeing the file.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
