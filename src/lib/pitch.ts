// Writes the sponsorship email draft. Server-side only (reads API keys).
//
// A language model writes the draft when a key is set:
// - OPENROUTER_API_KEY + LLM_MODEL (any OpenRouter model id, e.g. a ":free"
//   one for testing and a paid one later; changing the env var is enough), or
// - DEEPSEEK_API_KEY (DeepSeek's own API; DEEPSEEK_MODEL, default deepseek-flash).
// Without a key, or when the call fails (a free model hitting its rate limit
// with 429 included), a plain template is used, so the app always returns a
// draft. `source` and `note` in the result say which one it was and why.

import type { Admission, AudienceAge } from "./audience";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-flash";
const TIMEOUT_MS = 30_000;

export interface PitchInput {
  brand: {
    name: string;
    categoryLabel: string;
    /** From /api/brands or /api/places, e.g. "#2 of 15 beer brands for this crowd. ..." */
    reasonText: string;
    /** A national brand, or a local business near the event (cafe, shop, bar). */
    kind: "brand" | "place";
    /**
     * For a local place Qloo has little taste data for: its distance from the
     * search center, km. Then the pitch makes no taste claim at all; it pitches
     * being nearby. Null for everything else.
     */
    nearbyKm: number | null;
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
  /** "ai": written by the language model named in `model`. */
  source: "ai" | "template";
  model: string | null;
  /** Why the template was used, when it was. */
  note: string | null;
  ms: number;
}

/** 0.6 -> "0.6 km", 12.4 -> "12 km". */
function formatKm(km: number): string {
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
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
    input.brand.nearbyKm !== null
      ? `No taste match: Qloo has little taste data for this business. It is about ${formatKm(input.brand.nearbyKm)} from the center of ${input.city ?? "the city"}. Do not say or suggest that the crowd likes it.`
      : `Why it fits, from Qloo taste data: ${input.brand.reasonText}`,
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
- If the facts say "No taste match", do not mention Qloo or taste data and do not say or suggest that the crowd likes the business. Lead with how close it is, the crowd size and age, and what the sponsor gets.
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

  // No taste data: pitch being close by, never a taste match.
  const why =
    input.brand.nearbyKm !== null
      ? `I'm writing to ${brand} because you're close by: about ${formatKm(input.brand.nearbyKm)} from the center of ${input.city ?? "[city]"}. Our venue is [venue].`
      : `I'm writing to ${brand} specifically. Qloo's taste data shows that ${crowd} already like ${yours}: ${brand} ${rankClause(input.brand.reasonText)}`;

  const body = [
    "Hi [contact name],",
    "",
    `I'm organizing ${event}, ${input.admission?.phrase ?? "a show"} ${about.join(" ") || "[where and how big]"}${audience}.${lineUp}`,
    "",
    why,
    "",
    offer,
    "",
    "Could we set up a 15-minute call this week?",
    "",
    "Thanks,",
    input.organizer ?? "[your name]",
    "[phone or email]",
  ].join("\n");

  const subject =
    input.brand.nearbyKm !== null
      ? `${brand} x ${event}: a sponsor spot just down the road`
      : `${brand} x ${event}: a crowd that already likes you`;
  return { subject, body };
}

/** Turns the first sentence of reasonText into "ranks #2 of 15 beer brands for this crowd." */
function rankClause(reasonText: string): string {
  const first = reasonText.split(/(?<=\.)\s+/)[0] ?? reasonText;
  return first.startsWith("#") ? `ranks ${first}` : `is a strong match. ${first}`;
}

interface Provider {
  name: "OpenRouter" | "DeepSeek";
  url: string;
  apiKey: string;
  model: string;
  /** Provider-specific request fields. */
  extra: Record<string, unknown>;
  headers: Record<string, string>;
}

/** Which model to ask, or why none can be asked. */
function chooseProvider(): Provider | { missing: string } {
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openRouterKey) {
    const model = process.env.LLM_MODEL?.trim();
    if (!model) return { missing: "LLM_MODEL is not set" };
    return {
      name: "OpenRouter",
      url: OPENROUTER_URL,
      apiKey: openRouterKey,
      model,
      // Not every model on OpenRouter takes response_format, so the JSON shape
      // comes from the prompt and is read leniently (see parseDraft).
      extra: {},
      headers: { "X-Title": "Echolocate" },
    };
  }
  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (deepseekKey) {
    return {
      name: "DeepSeek",
      url: DEEPSEEK_URL,
      apiKey: deepseekKey,
      model: process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_DEEPSEEK_MODEL,
      extra: { thinking: { type: "disabled" }, response_format: { type: "json_object" } },
      headers: {},
    };
  }
  return { missing: "no AI key is set (OPENROUTER_API_KEY or DEEPSEEK_API_KEY)" };
}

async function llmDraft(input: PitchInput, provider: Provider): Promise<{ subject: string; body: string }> {
  const response = await fetch(provider.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
      ...provider.headers,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Facts:\n- ${facts(input).join("\n- ")}` },
      ],
      temperature: 0.7,
      max_tokens: 700,
      stream: false,
      ...provider.extra,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new LlmError(provider.name, response.status, text.trim().slice(0, 300));
  }

  const content = readContent(JSON.parse(text));
  if (!content) throw new Error(`${provider.name} returned an empty message`);
  return parseDraft(content);
}

/**
 * Reads {"subject", "body"} from the model's reply. Some models wrap JSON in
 * a code fence or add a line around it, so take the outermost {...}.
 */
function parseDraft(content: string): { subject: string; body: string } {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The model reply has no JSON object");
  const draft: unknown = JSON.parse(content.slice(start, end + 1));
  if (typeof draft !== "object" || draft === null) throw new Error("The model draft is not an object");
  const { subject, body } = draft as { subject?: unknown; body?: unknown };
  if (typeof subject !== "string" || typeof body !== "string" || !subject.trim() || !body.trim()) {
    throw new Error("The model draft is missing subject or body");
  }
  return { subject: subject.trim(), body: body.trim() };
}

class LlmError extends Error {
  status: number;

  constructor(provider: string, status: number, detail: string) {
    super(`${provider} returned ${status}: ${detail}`);
    this.name = "LlmError";
    this.status = status;
  }
}

/** Short reason that is safe to show in the browser. Full details go to the server log only. */
function publicReason(error: unknown, provider: Provider): string {
  if (error instanceof LlmError) {
    if (error.status === 401) return `the ${provider.name} key was rejected`;
    if (error.status === 402) return `the ${provider.name} account has no credit`;
    if (error.status === 404) return `the model ${provider.model} was not found`;
    if (error.status === 429) {
      return provider.model.endsWith(":free")
        ? "the free AI model is busy (rate limit)"
        : `${provider.name} is rate limiting us`;
    }
    return `${provider.name} returned status ${error.status}`;
  }
  if (error instanceof Error && error.name === "TimeoutError") return "the AI model took too long";
  return "the AI model gave an unusable reply";
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
  const provider = chooseProvider();

  if ("missing" in provider) {
    return {
      ...templateDraft(input),
      source: "template",
      model: null,
      note: `This draft comes from the built-in template because ${provider.missing}.`,
      ms: Date.now() - started,
    };
  }

  try {
    const draft = await llmDraft(input, provider);
    return { ...draft, source: "ai", model: provider.model, note: null, ms: Date.now() - started };
  } catch (error) {
    // The upstream message can echo part of the API key, so it stays in the server log.
    console.error(`Pitch fell back to the template: ${error instanceof Error ? error.message : String(error)}`);
    return {
      ...templateDraft(input),
      source: "template",
      model: null,
      note: `This draft comes from the built-in template because ${publicReason(error, provider)}.`,
      ms: Date.now() - started,
    };
  }
}
