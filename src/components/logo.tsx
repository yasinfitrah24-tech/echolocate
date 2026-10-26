// The Echolocate mark and wordmark ("Single ring").
//
// Mark: a thick tangerine ring around an ink dot, like a sound going out from
// the event. In the wordmark it takes the place of the second "o", sized to
// the lowercase letters and sitting on the baseline. The metaphor lives here
// and in the map, never in the copy.

/** The ring mark alone. `dot` is ink on light backgrounds, paper on dark ones. */
export function LogoMark({ size = 28, dot = "var(--color-ink)" }: { size?: number | string; dot?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="19" fill="none" stroke="var(--color-accent)" strokeWidth="10" />
      <circle cx="24" cy="24" r="5.5" fill={dot} />
    </svg>
  );
}

/** "Echolocate" in Bricolage, with the ring as the second "o". */
export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <span className="font-display inline-block leading-none whitespace-nowrap text-ink" style={{ fontSize: size }}>
      Echol
      <svg
        viewBox="0 0 48 48"
        aria-hidden="true"
        style={{ display: "inline", height: "0.56em", width: "0.56em", verticalAlign: "baseline", margin: "0 0.02em" }}
      >
        <circle cx="24" cy="24" r="19" fill="none" stroke="var(--color-accent)" strokeWidth="10" />
        <circle cx="24" cy="24" r="5.5" fill="currentColor" />
      </svg>
      cate
    </span>
  );
}
