// Writes the sponsorship email draft. Server-side only (reads DEEPSEEK_API_KEY).
//
// DeepSeek writes the draft when a key is set. Without a key, or when the call
// fails, a plain template is used instead, so the app always returns a draft.
// `source` in the result says which one it was.

import type { Admission, AudienceAge } from "./audience";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-flash";
const TIMEOUT_MS = 30_000;

export interface PitchInput {
  brand: {
    name: string;
    categoryLabel: string;
    /** From /api/brands or /api/places, e.g. "#2 of 15 beer brands for this crowd. ..." */
    reasonText: string;
    /** A national brand, or a local business near the event (cafe, shop, bar). */
    kind: "brand" | "place";
  };
  artists: string[];
  genre: string | null;
  eventName: string | null;
  city: string | null;
  crowdSize: number | null;
  age: AudienceAge | null;
  admission: Admission | null;
  organizer: string | null;
}

export interface PitchDraft {
  subject: string;
  body: string;
  source: "deepseek" | "template";
  model: string | null;
  /** Why the template was used, when it was. */
  note: string | null;
  ms: number;
}

/** "Cafes" -> "cafe", "Clothing stores" -> "clothing store". */
function placeNoun(categoryLabel: string): string {
  return categoryLabel.toLowerCase().replace(/s$/, "");
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The facts both the model and the template work from. Nothing else may be claimed. */
function facts(input: PitchInput): string[] {
  const lines = [
    input.brand.kind === "place"
      ? `Sponsor: ${input.brand.name}, a local ${placeNoun(input.brand.categoryLabel)} near the event`
      : `Brand: ${input.brand.name} (${input.brand.categoryLabel})`,
    `Why it fits, from Qloo taste data: ${input.brand.reasonText}`,
  ];
  if (input.eventName) lines.push(`Event name: ${input.eventName}`);
  if (input.city) lines.push(`City: ${input.city}`);
  if (input.crowdSize) lines.push(`Expected crowd: about ${input.crowdSize.toLocaleString("en-US")} people`);
  if (input.age) lines.push(`Audience age: mostly ${input.age.label}`);
  if (input.admission) lines.push(`Admission: ${input.admission.label} (${input.admission.phrase})`);
  if (input.artists.length > 0) lines.push(`Line-up: ${joinNames(input.artists)}`);
  if (input.genre) lines.push(`Genre: ${input.genre}`);
  if (input.organizer) lines.push(`Organizer (sender): ${input.organizer}`);
  return lines;
}

const SYSTEM_PROMPT = `You write short sponsorship outreach emails for organizers of small events (campus and community shows). The reader is a partnerships or marketing contact at the brand.

Rules:
- Use only the facts in the user message. Never invent numbers, past events, demographics, prices, dates or sponsorship tiers.
- When a detail you need is missing, leave a placeholder in square brackets, such as [date], [your name] or [contact name].
- Lead with why this brand fits this crowd, using the ranking given, and say it comes from Qloo taste data. Describe the "this crowd" as fans of the line-up.
- Offer one or two concrete ways to take part, written as options in square brackets for the organizer to edit.
- If the sponsor is a local business, say it is near the event and lead with in-kind options, such as [a discount for our attendees] or [your products at our table].
- End with one clear ask: a 15-minute call.
- Under 170 words. Plain, friendly and specific. No hype, no emojis, no exclamation marks.

Return a JSON object only, in this shape: {"subject": "...", "body": "..."}. Use \\n for line breaks in the body.`;

function templateDraft(input: PitchInput): { subject: string; body: string } {
  const event = input.eventName ?? "[event name]";
  const brand = input.brand.name;

  const about: string[] = [];
  if (input.city) about.push(`in ${input.city}`);
  if (input.crowdSize) about.push(`for about ${input.crowdSize.toLocaleString("en-US")} people`);
  const audience = input.age ? `, mostly ${input.age.label}` : "";
  const lineUp =
    input.artists.length > 0
      ? ` The line-up is ${joinNames(input.artists)}.`
      : input.genre
        ? ` It is ${/^[aeiou]/i.test(input.genre) ? "an" : "a"} ${input.genre} show.`
        : "";

  const crowd = input.artists.length > 0 ? "fans of this line-up" : "fans of this kind of music";
  const local = input.brand.kind === "place";
  const yours = local ? `your ${placeNoun(input.brand.categoryLabel)}` : "your brand";
  const offer = local
    ? `We'd like to offer ${brand} [a table at the event] in return for [a discount for our attendees] or [your products for our crew]. Details are flexible.`
    : `We'd like to offer ${brand} [a booth or sampling spot] and [logo placement on our posters and social posts]. Details are flexible.`;

  const body = [
    "Hi [contact name],",
    "",
    `I'm organizing ${event}, ${input.admission?.phrase ?? "a show"} ${about.join(" ") || "[where and how big]"}${audience}.${lineUp}`,
    "",
    `I'm writing to ${brand} specifically. Qloo's taste data shows that ${crowd} already like ${yours}: ${brand} ${rankClause(input.brand.reasonText)}`,
    "",
    offer,
    "",
    "Could we set up a 15-minute call this week?",
    "",
    "Thanks,",
    input.organizer ?? "[your name]",
    "[phone or email]",
  ].join("\n");

  return { subject: `${brand} x ${event}: a crowd that already likes you`, body };
}

/** Turns the first sentence of reasonText into "ranks #2 of 15 beer brands for this crowd." */
function rankClause(reasonText: string): string {
  const first = reasonText.split(/(?<=\.)\s+/)[0] ?? reasonText;
  return first.startsWith("#") ? `ranks ${first}` : `is a strong match. ${first}`;
}

async function deepseekDraft(
  input: PitchInput,
  apiKey: string,
  model: string,
): Promise<{ subject: string; body: string }> {
  const response = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Facts:\n- ${facts(input).join("\n- ")}` },
      ],
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 700,
      stream: false,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new DeepSeekError(response.status, text.trim().slice(0, 300));
  }

  const data: unknown = JSON.parse(text);
  const content = readContent(data);
  if (!content) throw new Error("DeepSeek returned an empty message");

  const draft: unknown = JSON.parse(content);
  if (typeof draft !== "object" || draft === null) throw new Error("DeepSeek draft is not an object");
  const { subject, body } = draft as { subject?: unknown; body?: unknown };
  if (typeof subject !== "string" || typeof body !== "string" || !subject.trim() || !body.trim()) {
    throw new Error("DeepSeek draft is missing subject or body");
  }
  return { subject: subject.trim(), body: body.trim() };
}

class DeepSeekError extends Error {
  status: number;

  constructor(status: number, detail: string) {
    super(`DeepSeek returned ${status}: ${detail}`);
    this.name = "DeepSeekError";
    this.status = status;
  }
}

/** Short reason that is safe to show in the browser. Full details go to the server log only. */
function publicReason(error: unknown): string {
  if (error instanceof DeepSeekError) {
    if (error.status === 401) return "the DeepSeek key was rejected";
    if (error.status === 402) return "the DeepSeek account has no balance";
    if (error.status === 429) return "DeepSeek is rate limiting us";
    return `DeepSeek returned status ${error.status}`;
  }
  if (error instanceof Error && error.name === "TimeoutError") return "DeepSeek took too long";
  return "DeepSeek gave an unusable reply";
}

function readContent(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: unknown } | null)?.message;
  const content = (message as { content?: unknown } | null | undefined)?.content;
  return typeof content === "string" && content.trim() ? content : null;
}

export async function writePitch(input: PitchInput): Promise<PitchDraft> {
  const started = Date.now();
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const model = process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_MODEL;

  if (!apiKey) {
    return {
      ...templateDraft(input),
      source: "template",
      model: null,
      note: "This draft comes from the built-in template because DEEPSEEK_API_KEY is not set.",
      ms: Date.now() - started,
    };
  }

  try {
    const draft = await deepseekDraft(input, apiKey, model);
    return { ...draft, source: "deepseek", model, note: null, ms: Date.now() - started };
  } catch (error) {
    // The upstream message can echo part of the API key, so it stays in the server log.
    console.error(`Pitch fell back to the template: ${error instanceof Error ? error.message : String(error)}`);
    return {
      ...templateDraft(input),
      source: "template",
      model: null,
      note: `This draft comes from the built-in template because ${publicReason(error)}.`,
      ms: Date.now() - started,
    };
  }
}
