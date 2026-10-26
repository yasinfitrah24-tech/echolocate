// The Echolocate mark and wordmark.
//
// Mark: a dot (the event), two arcs going out (the music on its line-up), and
// one dot beyond them (a sponsor that came back). The metaphor lives here and in
// the map, never in the copy.

export function LogoMark({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <circle cx="9" cy="16" r="4" fill="var(--color-ink, #1C1915)" />
      <path
        d="M14.69 9.68 A8.5 8.5 0 0 1 14.69 22.32"
        fill="none"
        stroke="var(--color-ink, #1C1915)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M19.77 6.3 A14.5 14.5 0 0 1 19.77 25.7"
        fill="none"
        stroke="var(--color-ink, #1C1915)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="27.3" cy="16" r="2.7" fill="var(--color-spot, #D7265E)" />
    </svg>
  );
}

/** Mark plus the name, set in condensed Archivo. */
export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      <span
        className="font-display font-extrabold uppercase leading-none tracking-[0.04em]"
        style={{ fontSize: Math.round(size * 0.72) }}
      >
        Echolocate
      </span>
    </span>
  );
}
