// The one-page sponsor sheet as a real PDF, drawn in the browser.
// @react-pdf/renderer is large, so this module is only loaded with import()
// when someone clicks "Download one-pager".

import { Document, Page, StyleSheet, Text, View, pdf, type Styles } from "@react-pdf/renderer";
import { pdfSafe, type OnePager } from "@/lib/one-pager";

const ink = "#18181b";
const muted = "#52525b";
const line = "#e4e4e7";
const soft = "#f4f4f5";

const styles = StyleSheet.create({
  page: { padding: 24, fontFamily: "Helvetica", fontSize: 8.75, color: ink, lineHeight: 1.35 },
  eyebrow: { fontSize: 7.5, letterSpacing: 1, color: muted, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 19, fontFamily: "Helvetica-Bold", lineHeight: 1.2, marginTop: 3 },
  subtitle: { fontSize: 10, color: muted, lineHeight: 1.3, marginTop: 2 },
  row: { flexDirection: "row", gap: 10, marginTop: 7 },
  section: { marginTop: 7 },
  heading: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  box: { borderWidth: 1, borderColor: line, borderRadius: 4, padding: 8 },
  softBox: { backgroundColor: soft, borderRadius: 4, padding: 8 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 },
  score: {
    backgroundColor: ink,
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 15,
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 3,
  },
  small: { fontSize: 7.5, color: muted },
  kv: { flexDirection: "row", marginBottom: 1.5 },
  kvLabel: { width: 58, color: muted },
  kvValue: { flex: 1 },
  bold: { fontFamily: "Helvetica-Bold" },
  pair: { flexDirection: "row", gap: 8 },
  cell: { flex: 1, borderWidth: 1, borderColor: line, borderRadius: 4, padding: 6 },
  bullet: { flexDirection: "row", marginTop: 1.5 },
  dot: { width: 9 },
  option: { flex: 1, borderWidth: 1, borderColor: line, borderRadius: 4, padding: 8 },
  amount: { fontSize: 12, fontFamily: "Helvetica-Bold", marginVertical: 2 },
});

/** Every string goes through pdfSafe so the built-in font can print it. */
function T({ children, style }: { children: string; style?: Styles[string] | Styles[string][] }) {
  return <Text style={style}>{pdfSafe(children)}</Text>;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <>
      {items.map((item) => (
        <View key={item} style={styles.bullet}>
          <Text style={styles.dot}>•</Text>
          <T style={{ flex: 1 }}>{item}</T>
        </View>
      ))}
    </>
  );
}

export function OnePagerDocument({ sheet }: { sheet: OnePager }) {
  return (
    <Document title={pdfSafe(sheet.title)} author="Echolocate" subject="Sponsorship one-pager">
      <Page size={sheet.paper} style={styles.page}>
        <T style={styles.eyebrow}>SPONSORSHIP ONE-PAGER</T>
        <T style={styles.title}>{sheet.title}</T>
        <T style={styles.subtitle}>{`Prepared for ${sheet.brandName} · ${sheet.categoryLabel}`}</T>

        <View style={styles.row}>
          <View style={{ flex: 1.4, gap: 8 }}>
            <View style={styles.box}>
            <T style={styles.heading}>{sheet.whyHeading}</T>
            {sheet.fitScore !== null ? (
              <View style={styles.scoreRow}>
                <T style={styles.score}>{String(sheet.fitScore)}</T>
                <View style={{ flex: 1 }}>
                  <T style={styles.bold}>Sponsor Fit Score (out of 100)</T>
                  <T>{sheet.reasonText}</T>
                </View>
              </View>
            ) : (
              // A place with little taste data: no score, only the reason.
              <T>{sheet.reasonText}</T>
            )}
            {sheet.scoreNote && <T style={styles.small}>{sheet.scoreNote}</T>}
            </View>
            {sheet.confirmed.length > 0 && (
              <View style={styles.box}>
                <T style={styles.heading}>Confirmed so far</T>
                <Bullets items={sheet.confirmed} />
              </View>
            )}
          </View>

          <View style={[styles.box, { flex: 1 }]}>
            <T style={styles.heading}>The event</T>
            {sheet.event.map((item) => (
              <View key={item.label} style={styles.kv}>
                <T style={styles.kvLabel}>{item.label}</T>
                <T style={styles.kvValue}>{item.value}</T>
              </View>
            ))}
            {sheet.cityNote && <T style={[styles.small, { marginTop: 3 }]}>{sheet.cityNote}</T>}
          </View>
        </View>

        <View style={[styles.softBox, styles.section]}>
          <T style={styles.heading}>{sheet.profileHeading}</T>
          <View style={styles.kv}>
            <T style={[styles.kvLabel, { width: 132 }]}>{sheet.music.label}</T>
            <T style={styles.kvValue}>{sheet.music.value}</T>
          </View>
          {sheet.alsoLikes.length > 0 && (
            <View style={styles.kv}>
              <T style={[styles.kvLabel, { width: 132 }]}>Fans also like</T>
              <T style={styles.kvValue}>{sheet.alsoLikes.join(", ")}</T>
            </View>
          )}
          {sheet.similarBrands.length > 0 && (
            <View style={styles.kv}>
              <T style={[styles.kvLabel, { width: 132 }]}>{sheet.similarLabel}</T>
              <T style={styles.kvValue}>{sheet.similarBrands.join(", ")}</T>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <T style={styles.heading}>Your questions, answered</T>
          {[sheet.questions.slice(0, 2), sheet.questions.slice(2, 4)].map((pair, index) => (
            <View key={index} style={[styles.pair, { marginTop: index === 0 ? 0 : 6 }]}>
              {pair.map((item) => (
                <View key={item.question} style={styles.cell}>
                  <T style={styles.bold}>{item.question}</T>
                  <Bullets items={item.answer} />
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <T style={styles.heading}>Ways to take part</T>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {sheet.options.map((option) => (
              <View key={option.label} style={styles.option}>
                <T style={styles.bold}>{option.label}</T>
                <T style={styles.amount}>{option.amount}</T>
                <T style={{ color: muted }}>{option.detail}</T>
              </View>
            ))}
          </View>
          {sheet.exclusivity && <T style={{ marginTop: 5 }}>{sheet.exclusivity}</T>}
        </View>

        <View style={styles.row}>
          <View style={[styles.box, { flex: 1.4 }]}>
            <T style={styles.heading}>How you measure results</T>
            <Bullets items={sheet.measure} />
          </View>
          <View style={[styles.softBox, { flex: 1 }]}>
            <T style={styles.heading}>{sheet.ask}</T>
            {sheet.contact.map((item) => (
              <T key={item}>{item}</T>
            ))}
            <T style={[styles.small, { marginTop: 5 }]}>{sheet.footer}</T>
          </View>
        </View>
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
