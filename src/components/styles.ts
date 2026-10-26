// Shared class names for the theme, so fields, buttons and cards look the same
// on every part of the page. Colours, radii and the font-display utility come
// from globals.css. Each size is its own constant: Tailwind does not let a
// later class override an earlier one of the same kind, so never append a
// second padding, height or width to these.

const field =
  "rounded-field border-[1.5px] border-field bg-card text-ink placeholder:text-ink-3 focus-visible:border-2 focus-visible:border-ink disabled:opacity-60";

/** Text fields and selects in the event form: 50 px tall. */
export const inputClass = `${field} h-[50px] w-full px-3.5 text-base`;

/** Smaller fields, in the one-pager panel. */
export const smallInputClass = `${field} h-10 w-full px-3 text-[15px]`;
export const smallSelectClass = `${field} h-10 px-3 text-[15px]`;

export const labelClass = "mb-2 block text-[15px] font-bold text-ink";

const button =
  "inline-flex items-center justify-center gap-2 rounded-full border-2 border-ink font-bold text-ink disabled:cursor-not-allowed disabled:opacity-60";
const primary = `${button} bg-accent shadow-hard hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_var(--color-ink)]`;
const secondary = `${button} bg-card hover:bg-accent-tint`;

/** The one main action of a part of the page. */
export const primaryButton = `${primary} px-[26px] py-3.5 text-[17px]`;
export const primaryButtonSmall = `${primary} px-[18px] py-2.5 text-[15px]`;
export const secondaryButtonSmall = `${secondary} px-[18px] py-2.5 text-[15px]`;

/** The hero's two calls to action. */
export const heroPrimaryButton = `${primary} px-[26px] py-4 text-lg`;
export const heroSecondaryButton = `${secondary} px-[26px] py-4 text-lg`;

/** Small row actions (Draft pitch, Make one-pager). */
export const ghostButton = `${button} bg-card px-[13px] py-1.5 text-[13px] hover:bg-accent-tint disabled:hover:bg-card`;

export const cardClass = "rounded-card border-2 border-ink bg-card";

/** Category and section titles inside cards, in poster type. */
export const cardTitleClass = "font-display text-[21px] uppercase tracking-[0.04em] md:text-2xl";

/** Section headings on the page (How it works, Use your own event, Local sponsors). */
export const sectionTitleClass = "font-display text-[34px] md:text-5xl";

/** Small caps label above a heading. */
export const eyebrowClass = "text-sm font-bold uppercase tracking-[0.12em] text-ink-3";

export const linkClass =
  "font-bold text-ink underline decoration-2 underline-offset-[3px] hover:decoration-accent";

/** Notices inside the results. */
export const noticeClass = "rounded-field border-2 border-ink bg-card px-4 py-3 text-[15px] text-ink";
export const warnNoticeClass = "rounded-field border border-warn/40 bg-warn-tint px-4 py-3 text-[15px] text-warn";
export const errorNoticeClass =
  "rounded-field border border-error bg-error-tint px-4 py-3 text-[15px] font-semibold text-error";
