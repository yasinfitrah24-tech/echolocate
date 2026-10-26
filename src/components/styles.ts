// Shared class names for the theme, so fields, buttons and cards look the same
// on every part of the page. Colours, radii and the font-display utility come
// from globals.css. Each size is its own constant: Tailwind does not let a
// later class override an earlier one of the same kind, so never append a
// second padding or width to these.

const field = "rounded-control border border-field bg-card text-sm text-ink placeholder:text-ink-3 disabled:opacity-60";

/** Text fields and selects in the event form. */
export const inputClass = `${field} w-full px-3 py-2`;

/** Smaller fields, in the one-pager panel. */
export const smallInputClass = `${field} w-full px-2.5 py-1.5`;
export const smallSelectClass = `${field} px-2.5 py-1.5`;

export const labelClass = "mb-1 block text-sm font-semibold text-ink";

const button =
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold disabled:cursor-not-allowed";
const primary = `${button} border-2 border-spot bg-spot text-white hover:border-spot-ink hover:bg-spot-ink disabled:opacity-60`;
const secondary = `${button} border-2 border-ink bg-transparent text-ink hover:bg-ink hover:text-white disabled:opacity-60`;

/** The one main action of a part of the page. */
export const primaryButton = `${primary} px-5 py-2.5 text-sm`;
export const primaryButtonSmall = `${primary} px-4 py-2 text-sm`;

/** The hero's two calls to action. */
export const heroPrimaryButton = `${primary} px-6 py-3 text-base`;
export const heroSecondaryButton = `${secondary} px-6 py-3 text-base`;

/** Small row actions (Draft pitch, Make one-pager): quiet next to the content. */
export const ghostButton = `${button} border border-field bg-card px-2.5 py-1 text-xs text-ink hover:border-ink hover:bg-paper disabled:opacity-50 disabled:hover:border-field disabled:hover:bg-card`;

export const cardClass = "rounded-card border border-line bg-card";

/** Category and section titles inside cards, in poster type. */
export const cardTitleClass = "font-display text-[22px] uppercase tracking-[0.02em]";

/** Small caps label above a heading. */
export const eyebrowClass = "text-xs font-bold uppercase tracking-[0.12em] text-spot-ink";

export const linkClass = "font-semibold text-spot-ink underline underline-offset-[3px] hover:text-ink";

/** Notices inside the results. */
export const noticeClass = "rounded-card border border-line bg-card px-4 py-3 text-sm text-ink";
export const warnNoticeClass = "rounded-card border border-warn/30 bg-warn-tint px-4 py-3 text-sm text-warn";
export const errorNoticeClass = "rounded-card border border-error/30 bg-error-tint px-4 py-3 text-sm text-error";
