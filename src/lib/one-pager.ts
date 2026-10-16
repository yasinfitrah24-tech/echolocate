// Builds the text of the one-page sponsor sheet. Safe to import from client components.
//
// Uses only data we already have: the /api/brands result plus what the organizer
// typed. No extra Qloo calls. Anything we do not know is left in [square brackets]
// for the organizer to fill in, like the pitch draft.

import { findAdmission, findAudienceAge } from "./audience";
import type { Brand, BrandCategory } from "./qloo";

export const BENEFITS = [
  { id: "signage", label: "Logo on posters and signage" },
  { id: "emails", label: "Opt-in email sign-ups at your table" },
  { id: "booth", label: "A booth or sampling table" },
  { id: "shoutout", label: "Shoutouts from the stage and on social" },
] as const;

export type BenefitId = (typeof BENEFITS)[number]["id"];

export type Paper = "LETTER" | "A4";

/** Details the organizer can mark as confirmed. Filling a field is not enough. */
export type ConfirmId = "date" | "venue" | "preRegistered" | "otherSponsors";

/** What the organizer adds before downloading. Every field is optional. */
export interface OnePagerDetails {
  date: string;
  venue: string;
  organizer: string;
  contact: string;
  preRegistered: string;
  otherSponsors: string;
  tier1Amount: string;
  tier1Includes: string;
  tier2Amount: string;
  tier2Includes: string;
  benefits: Record<BenefitId, boolean>;
  confirmed: Record<ConfirmId, boolean>;
  exclusivity: boolean;
  discountCode: string;
  offerLink: string;
  paper: Paper;
}

export const EMPTY_DETAILS: OnePagerDetails = {
  date: "",
  venue: "",
  organizer: "",
  contact: "",
  preRegistered: "",
  otherSponsors: "",
  tier1Amount: "",
  tier1Includes: "",
  tier2Amount: "",
  tier2Includes: "",
  benefits: { signage: false, emails: false, booth: false, shoutout: false },
  confirmed: { date: false, venue: false, preRegistered: false, otherSponsors: false },
  exclusivity: false,
  discountCode: "",
  offerLink: "",
  paper: "LETTER",
};

/** Longest text a detail field may hold, so the sheet stays on one page. */
export const DETAIL_MAX_LENGTH = 60;

/** The search the brands came from, as checked by the server. */
export interface SearchFacts {
  eventName: string | null;
  crowdSize: number | null;
  city: string | null;
  cityDropped: boolean;
  age: string | null;
  admission: string;
  genre: string | null;
  artists: string[];
  genreTags: string[];
}

export interface OnePager {
  title: string;
  brandName: string;
  categoryLabel: string;
  fitScore: number;
  reasonText: string;
  scoreNote: string;
  event: { label: string; value: string }[];
  cityNote: string | null;
  music: { label: string; value: string };
  alsoLikes: string[];
  similarBrands: string[];
  similarLabel: string;
  questions: { question: string; answer: string[] }[];
  options: { label: string; amount: string; detail: string }[];
  exclusivity: string | null;
  confirmed: string[];
  measure: string[];
  ask: string;
  contact: string[];
  footer: string;
  paper: Paper;
}

const ALSO_LIKES = 5;
const SIMILAR = 4;

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// The PDF uses the built-in Helvetica, which only has WinAnsi glyphs: Latin-1
// plus curly quotes, dashes, bullets and a few more. Anything else would print
// as a blank box, so accents outside that set are dropped ("Allē" -> "Alle").
const WIN_ANSI_EXTRA = new Set([
  0x152, 0x153, 0x160, 0x161, 0x178, 0x17d, 0x17e, 0x192, 0x2c6, 0x2dc, 0x2013, 0x2014,
  0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e, 0x2020, 0x2021, 0x2022, 0x2026, 0x2030,
  0x2039, 0x203a, 0x20ac, 0x2122,
]);

function inWinAnsi(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(code);
}

/** Makes text printable with the PDF's built-in font. */
export function pdfSafe(text: string): string {
  let out = "";
  for (const char of text) {
    if (inWinAnsi(char)) {
      out += char;
      continue;
    }
    // "ē" -> "e" + combining macron; keep the parts the font has.
    const base = [...char.normalize("NFD")].filter(inWinAnsi).join("");
    out += base || (/\s/.test(char) ? " " : "?");
  }
  return out;
}

function orBracket(value: string, placeholder: string): string {
  const text = value.trim();
  return text ? text : `[${placeholder}]`;
}

/** Alcohol brands only for 21+ events, the same rule the server uses. */
export function onePagerAllowed(brand: Pick<Brand, "alcohol">, admission: string): boolean {
  return !brand.alcohol || (findAdmission(admission)?.alcoholAllowed ?? false);
}

export function buildOnePager(
  brand: Brand,
  category: BrandCategory,
  categories: BrandCategory[],
  search: SearchFacts,
  details: OnePagerDetails,
): OnePager | null {
  if (!onePagerAllowed(brand, search.admission)) return null;

  const admission = findAdmission(search.admission);
  const age = findAudienceAge(search.age);
  const eventName = search.eventName ?? "[event name]";
  const crowd = search.crowdSize
    ? `About ${search.crowdSize.toLocaleString("en-US")} people`
    : "[expected crowd]";

  const music =
    search.artists.length > 0
      ? { label: "Line-up", value: joinNames(search.artists) }
      : { label: "Genre", value: search.genre ?? (joinNames(search.genreTags) || "[line-up]") };
  const fans = search.artists.length > 0 ? "fans of this line-up" : "fans of this kind of music";

  // Brands from other categories, all already filtered by the server (alcohol, NGOs).
  const alsoLikes = categories
    .filter((other) => other.id !== category.id)
    .flatMap((other) => other.brands.map((item) => ({ item, label: other.label })))
    .filter(({ item }) => item.entityId !== brand.entityId && onePagerAllowed(item, search.admission))
    .sort((a, b) => b.item.fitScore - a.item.fitScore)
    .slice(0, ALSO_LIKES)
    .map(({ item, label }) => `${item.name} (${label.toLowerCase()})`);

  const similarBrands = category.brands
    .filter((item) => item.entityId !== brand.entityId && onePagerAllowed(item, search.admission))
    .slice(0, SIMILAR)
    .map((item) => item.name);

  const benefits = BENEFITS.filter((benefit) => details.benefits[benefit.id]).map((b) => b.label);
  const preRegistered = details.preRegistered.trim();
  const otherSponsors = details.otherSponsors.trim();

  const who = [
    age ? `Mostly ${age.label}` : "[age range]",
    admission ? `${admission.label} event` : "[admission]",
    `${fans[0].toUpperCase()}${fans.slice(1)}`,
  ];

  // Only what the organizer ticked as confirmed (and filled in). Sponsors want
  // to see they would not be the first money in, but a typed venue is not a
  // booked venue. Short on purpose: the values already show above.
  const isConfirmed = (id: ConfirmId, value: string) => details.confirmed[id] && value.trim() !== "";
  const confirmed: string[] = [];
  if (isConfirmed("date", details.date)) confirmed.push("Date confirmed");
  if (isConfirmed("venue", details.venue)) confirmed.push("Venue confirmed");
  if (isConfirmed("preRegistered", preRegistered)) confirmed.push(`Pre-registrations: ${preRegistered}`);
  if (isConfirmed("otherSponsors", otherSponsors)) confirmed.push("Other sponsors confirmed");

  const code = orBracket(details.discountCode, "CODE");
  const link = orBracket(details.offerLink, "link to your offer");

  return {
    title: `${eventName} for ${brand.name}`,
    brandName: brand.name,
    categoryLabel: category.label,
    fitScore: brand.fitScore,
    reasonText: brand.reasonText,
    scoreNote:
      "Sponsor Fit Score is our own 0 to 100 score. It comes from where the brand ranks in Qloo's taste data for this crowd and how evenly the line-up supports it.",
    event: [
      { label: "Event", value: eventName },
      { label: "City", value: search.city ?? "[city]" },
      { label: "Date", value: orBracket(details.date, "date") },
      { label: "Venue", value: orBracket(details.venue, "venue") },
      { label: "Crowd", value: crowd },
      { label: "Audience", value: age ? `Mostly ${age.label}` : "[age range]" },
      { label: "Admission", value: admission?.label ?? "[admission]" },
    ],
    cityNote: search.cityDropped
      ? `Qloo has no taste data for ${search.city}, so these matches use the line-up alone.`
      : null,
    music,
    alsoLikes,
    similarBrands,
    similarLabel: `Other ${category.label.toLowerCase()} brands fans like`,
    questions: [
      {
        question: "How many people?",
        answer: [
          crowd,
          ...(isConfirmed("preRegistered", preRegistered) ? [`${preRegistered} pre-registered so far`] : []),
        ],
      },
      { question: "Who comes?", answer: who },
      {
        question: "What do you get?",
        answer: benefits.length > 0 ? benefits : ["[signage, opt-in email sign-ups, a booth, shoutouts]"],
      },
      {
        question: "Who else is sponsoring?",
        // Names only once the organizer ticks them as confirmed.
        answer: [
          !otherSponsors
            ? "[other sponsors]"
            : isConfirmed("otherSponsors", otherSponsors)
              ? otherSponsors
              : "Other sponsors: to be confirmed",
        ],
      },
    ],
    options: [
      {
        label: "Supporter",
        amount: orBracket(details.tier1Amount, "amount"),
        detail: orBracket(details.tier1Includes, "what this includes"),
      },
      {
        label: "Partner",
        amount: orBracket(details.tier2Amount, "amount"),
        detail: orBracket(details.tier2Includes, "what this includes"),
      },
      {
        label: "In kind",
        amount: "No cash needed",
        detail: "Product, discounts, vouchers, or covering a venue cost.",
      },
    ],
    exclusivity: details.exclusivity
      ? `${brand.name} can be the only ${category.label.toLowerCase()} sponsor at ${eventName}.`
      : null,
    confirmed,
    measure: [
      `A discount code just for this event: ${code}`,
      `A QR code on our signage that links to ${link}`,
      ...(details.benefits.emails ? ["The opt-in email sign-ups collected at your table"] : []),
    ],
    ask: "Could we set up a 15-minute call?",
    contact: [orBracket(details.organizer, "your name"), orBracket(details.contact, "email or phone")],
    footer: "Brand matches from Qloo taste data, prepared with Echolocate.",
    paper: details.paper,
  };
}
