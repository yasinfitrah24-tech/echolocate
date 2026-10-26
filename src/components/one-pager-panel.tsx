"use client";

// Small panel under a brand or a local place: optional details, then "Download PDF".
// Everything here is optional; blanks show up as [brackets] in the PDF.

import { useState } from "react";
import {
  BENEFITS,
  DETAIL_MAX_LENGTH,
  type ConfirmId,
  type OnePager,
  type OnePagerDetails,
  type Paper,
} from "@/lib/one-pager";

type TextField = {
  [K in keyof OnePagerDetails]: OnePagerDetails[K] extends string ? K : never;
}[keyof OnePagerDetails];

const FIELDS: { key: TextField; label: string; placeholder: string; confirm?: ConfirmId }[] = [
  { key: "date", label: "Date", placeholder: "e.g. Sat, Nov 22, 7 pm", confirm: "date" },
  { key: "venue", label: "Venue", placeholder: "e.g. Student Union lawn", confirm: "venue" },
  {
    key: "preRegistered",
    label: "Pre-registered so far",
    placeholder: "e.g. 120 people",
    confirm: "preRegistered",
  },
  {
    key: "otherSponsors",
    label: "Other sponsors so far",
    placeholder: "e.g. Bean There Cafe",
    confirm: "otherSponsors",
  },
  { key: "tier1Amount", label: "Supporter amount", placeholder: "e.g. $250" },
  { key: "tier1Includes", label: "Supporter includes", placeholder: "e.g. Logo on posters + shoutout" },
  { key: "tier2Amount", label: "Partner amount", placeholder: "e.g. $500+" },
  { key: "tier2Includes", label: "Partner includes", placeholder: "e.g. Booth + email sign-ups" },
  { key: "discountCode", label: "Discount code", placeholder: "e.g. QUAD15" },
  { key: "offerLink", label: "QR code link", placeholder: "e.g. yoursite.com/offer" },
  { key: "organizer", label: "Your name", placeholder: "e.g. Sam Lee" },
  { key: "contact", label: "Email or phone", placeholder: "e.g. sam@example.edu" },
];

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none";

function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function OnePagerPanel({
  kind,
  name,
  sponsorNoun,
  eventName,
  build,
  blockedText,
  details,
  onDetailsChange,
}: {
  kind: "brand" | "place";
  /** The brand or place name. */
  name: string;
  /** "drinks" for a brand, "cafe" for a place: "the only <noun> sponsor". */
  sponsorNoun: string;
  eventName: string | null;
  /** buildOnePager or buildPlaceOnePager with everything but the details filled in. */
  build: (details: OnePagerDetails) => OnePager | null;
  /** Shown when build refuses (alcohol brand or bar, event not 21+). */
  blockedText: string;
  details: OnePagerDetails;
  onDetailsChange: (details: OnePagerDetails) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    const sheet = build(details);
    if (!sheet) {
      setError(blockedText);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { downloadOnePager } = await import("./one-pager-pdf");
      const file = [slug(eventName ?? "event"), slug(name)].filter(Boolean).join("-");
      await downloadOnePager(sheet, `${file || "sponsor"}-one-pager.pdf`);
    } catch (problem) {
      console.error(problem);
      setError("Could not make the PDF. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      {/* The PDF can be made right away; the fields below are optional. */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={download}
          disabled={busy}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:bg-zinc-400"
        >
          {busy ? "Making PDF…" : "Download PDF"}
        </button>
        <p className="text-xs text-zinc-600">Ready now, or add your details below first.</p>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        All optional. Blank fields show as [brackets] in the PDF, so you can fill them in later.
        Tick &ldquo;Confirmed&rdquo; only for what is locked in; those go in a &ldquo;Confirmed so far&rdquo; box.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {FIELDS.map((field) => {
          const confirm = field.confirm;
          // A local place's sheet never says "venue".
          const label = kind === "place" && field.key === "venue" ? "Location" : field.label;
          const empty = details[field.key].trim() === "";
          return (
            <div key={field.key}>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={`one-pager-${field.key}`} className="text-xs font-medium text-zinc-700">
                  {label}
                </label>
                {confirm && (
                  <label
                    className={`flex items-center gap-1.5 text-xs ${empty ? "text-zinc-400" : "text-zinc-700"}`}
                    title={empty ? "Fill this in first" : undefined}
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5"
                      checked={details.confirmed[confirm] && !empty}
                      disabled={empty}
                      onChange={(event) =>
                        onDetailsChange({
                          ...details,
                          confirmed: { ...details.confirmed, [confirm]: event.target.checked },
                        })
                      }
                    />
                    Confirmed
                  </label>
                )}
              </div>
              <input
                id={`one-pager-${field.key}`}
                className={`${inputClass} mt-1`}
                value={details[field.key]}
                maxLength={DETAIL_MAX_LENGTH}
                placeholder={field.placeholder}
                autoComplete="off"
                onChange={(event) => onDetailsChange({ ...details, [field.key]: event.target.value })}
              />
            </div>
          );
        })}
      </div>

      <fieldset className="mt-4">
        <legend className="text-xs font-medium text-zinc-700">What the sponsor gets</legend>
        <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
          {BENEFITS.map((benefit) => (
            <label key={benefit.id} className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={details.benefits[benefit.id]}
                onChange={(event) =>
                  onDetailsChange({
                    ...details,
                    benefits: { ...details.benefits, [benefit.id]: event.target.checked },
                  })
                }
              />
              {benefit.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-3 flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={details.exclusivity}
          onChange={(event) => onDetailsChange({ ...details, exclusivity: event.target.checked })}
        />
        Offer to make {name} the only {sponsorNoun} sponsor
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          aria-label="Paper size"
          className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm"
          value={details.paper}
          onChange={(event) => onDetailsChange({ ...details, paper: event.target.value as Paper })}
        >
          <option value="LETTER">US Letter</option>
          <option value="A4">A4</option>
        </select>
        <button
          type="button"
          onClick={download}
          disabled={busy}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:bg-zinc-400"
        >
          {busy ? "Making PDF…" : "Download PDF"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
