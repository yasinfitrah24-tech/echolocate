// Qloo client for Echolocate. Server-side only: it reads QLOO_API_KEY from the
// environment, so never import this file from a client component.
//
// Things the hackathon API taught us (tested 6 Oct):
// - Only https://hackathon.api.qloo.com works, with the X-Api-Key header.
// - Unknown parameters are ignored silently, so a typo gives an empty or
//   unfiltered result instead of an error. Every call is logged in `calls`
//   with its result count so that is easy to spot.
// - One call takes about 1.5 s, so independent calls run in parallel.
// - The key is rate limited: 9 calls in a burst got 429 "Rate limit exceeded"
//   on 2 of them (10 Oct). So at most MAX_CONCURRENT calls run at once, and a
//   429 is retried with a growing wait.
// - entity.query.affinity sits in a narrow band per kind of list (top-50
//   brands 0.94-0.97), so the Sponsor Fit Score puts it on a fixed scale; see
//   fitScore().

const BASE_URL = "https://hackathon.api.qloo.com";
const TIMEOUT_MS = 20_000;
const MAX_CONCURRENT = 3;
const MAX_RETRIES = 4;
const RETRY_BASE_MS = 500;
const BRAND_TAG_PREFIX = "urn:tag:genre:brand:";
const MUSIC_TAG_PREFIX = "urn:tag:genre:music:";
const NGO_TAG_PREFIX = "urn:tag:genre:brand:ngo";
// Big institutions Qloo files as "brands" that will not sponsor a small show:
// sports teams, universities, museums, news outlets (stage 7 test, 18 Oct:
// Atlanta Hawks, Cornell, MoMA, The New York Times, NPR...). Matched with any
// subcategory. Banks like Goldman Sachs share one financial_services tag with
// Chime and Venmo, so they cannot be told apart by tag and stay.
const NOT_SPONSOR_TAGS = [
  "urn:tag:genre:brand:sports_organization",
  "urn:tag:genre:brand:academic",
  "urn:tag:genre:brand:cultural_arts",
  "urn:tag:genre:brand:entertainment:media:news_and_politics",
];

/** Advocacy groups and big institutions come back as "brands". Not sponsors. */
function notASponsor(tagIds: string[]): boolean {
  return tagIds.some(
    (id) =>
      id.startsWith(NGO_TAG_PREFIX) ||
      NOT_SPONSOR_TAGS.some((tag) => id === tag || id.startsWith(`${tag}:`)),
  );
}
const ALCOHOL_TAG_PREFIX = "urn:tag:genre:brand:wine_and_spirits";

// Only "24_and_younger" has been tested against the API. The other values come
// from the Qloo docs; check the result changes before relying on them.
export const AGE_GROUPS = [
  "24_and_younger",
  "25_to_29",
  "30_to_34",
  "35_to_44",
  "45_to_54",
  "55_and_older",
] as const;

export type AgeGroup = (typeof AGE_GROUPS)[number];

export interface ArtistMatch {
  entityId: string;
  name: string;
  popularity: number | null;
  imageUrl: string | null;
  description: string | null;
  /** False when Qloo returned a different name than the one typed (e.g. "Wishy" -> "Wish You Were Here"). */
  exactName: boolean;
}

export interface GenreTag {
  id: string;
  name: string;
}

export interface BrandReason {
  /** Entity id or tag id of the line-up signal. */
  id: string;
  name: string;
  /** Raw contribution score from Qloo explainability. */
  score: number;
  /** This signal's share of the total contribution, 0-1. */
  share: number;
}

export interface Brand {
  entityId: string;
  name: string;
  categoryId: string;
  /** Sponsor Fit Score, 0-95. Our own formula, see fitScore(). */
  fitScore: number;
  /** Position in the Qloo list this brand came from (1 = best). */
  rank: number;
  listSize: number;
  /** "general" = top brands across all categories, "category" = a category-specific query. */
  source: "general" | "category";
  affinity: number | null;
  popularity: number | null;
  imageUrl: string | null;
  description: string | null;
  reasons: BrandReason[];
  /** Short English explanation: where the brand ranks, and which part of the line-up it leans to. */
  reasonText: string;
  /** Beer, wine or spirits (any wine_and_spirits tag). Only allowed for 21+ events. */
  alcohol: boolean;
}

export interface BrandCategory {
  id: string;
  label: string;
  brands: Brand[];
}

export interface QlooCall {
  label: string;
  endpoint: string;
  /** Query parameters as sent (never includes the API key). */
  params: Record<string, string>;
  ms: number;
  resultCount: number;
  /** How many times the call was repeated after a rate limit or server error. */
  retries: number;
  /** Set when the call failed. Always CALL_FAILED: the log is sent to the browser. */
  error?: string;
  /** Answered from the saved demo recording, without calling Qloo. */
  saved?: boolean;
}

/** The only error text a call log entry carries; details go to the server log. */
const CALL_FAILED = "failed";

export interface SponsorBrandsInput {
  /** Confirmed artists from searchArtists(). */
  artists?: { entityId: string; name: string }[];
  /** Genre tags from searchGenreTags(), used when an artist is not in Qloo. */
  genreTags?: GenreTag[];
  /** e.g. "Austin, TX" */
  city?: string;
  age?: AgeGroup;
  /**
   * Beer, wine and spirits. Default false. When false, the beer and spirits
   * queries are skipped and any brand Qloo tags as wine_and_spirits is dropped
   * from every list. The filter is only as good as Qloo's tags.
   */
  includeAlcohol?: boolean;
  /** Called as each round of brand calls starts, for the progress line in the UI. */
  onStep?: (step: "brands" | "brands-without-city") => void;
}

export interface SponsorBrandsResult {
  categories: BrandCategory[];
  calls: QlooCall[];
  /**
   * True when a city was given but Qloo returned nothing for it, so the brands
   * are for the line-up alone. Seen with small places such as "Indio, CA".
   */
  cityDropped: boolean;
}

export class QlooError extends Error {
  status: number | null;
  /** Retries already spent before giving up. */
  retries: number;
  /** "no_key": the server has no QLOO_API_KEY; "failed": anything else. */
  kind: "no_key" | "failed";

  constructor(message: string, status: number | null = null, retries = 0, kind: "no_key" | "failed" = "failed") {
    super(message);
    this.name = "QlooError";
    this.status = status;
    this.retries = retries;
    this.kind = kind;
  }
}

// Categories that usually sponsor events but are thin in the general top-50
// (which is mostly fashion). Each one gets its own query. General tags only:
// Qloo's subcategories are inconsistent (Red Bull is only "drinks").
const SPONSOR_CATEGORIES: {
  id: string;
  label: string;
  tag: string;
  alcohol: boolean;
}[] = [
  {
    id: "drinks",
    label: "Drinks",
    tag: "urn:tag:genre:brand:food_and_beverage:drinks",
    alcohol: false,
  },
  {
    id: "beer",
    label: "Beer",
    tag: "urn:tag:genre:brand:wine_and_spirits:beer",
    alcohol: true,
  },
  {
    id: "spirits",
    label: "Spirits",
    tag: "urn:tag:genre:brand:wine_and_spirits:spirits",
    alcohol: true,
  },
  {
    id: "financial_services",
    label: "Financial services",
    tag: "urn:tag:genre:brand:financial_services",
    alcohol: false,
  },
];

const GENERAL_TAKE = 50;

/** Brand cards for these come first (sorted by score among themselves): the categories that usually sponsor events. */
const MAIN_SPONSOR_CATEGORIES = [
  "drinks",
  "beer",
  "spirits",
  "wine_and_spirits",
  "financial_services",
  "dining",
  "fashion",
  "retail",
];
/** Shown last (before "Other"): rarely a sponsor for a small show. */
const LOW_CATEGORIES = ["mobile_app", "website", "entertainment"];
const CATEGORY_TAKE = 15;

// ---------- small helpers for reading untyped JSON ----------

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asObject(value: unknown): Json {
  return isObject(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function humanize(segment: string): string {
  const text = segment.replace(/_and_/g, " & ").replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------- HTTP ----------

/**
 * Optional store of saved Qloo responses, keyed by path + parameters. Plugged
 * in by src/lib/demo-recording.ts (Next routes only), so this file still runs
 * under plain Node for the probe scripts.
 */
export interface QlooCache {
  get(key: string): unknown;
  put?(path: string, key: string, data: unknown): void;
}

let cache: QlooCache | null = null;

export function setQlooCache(next: QlooCache | null): void {
  cache = next;
}

function requestKey(path: string, sent: Record<string, string>): string {
  const query = Object.keys(sent)
    .sort()
    .map((key) => `${key}=${sent[key]}`)
    .join("&");
  return `${path}?${query}`;
}

// Live calls to Qloo today (UTC), counted per server instance, for the demo budget.
let liveDay = "";
let liveCount = 0;

function countLiveCall(): void {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== liveDay) {
    liveDay = today;
    liveCount = 0;
  }
  liveCount += 1;
}

export function liveCallsToday(): number {
  return liveDay === new Date().toISOString().slice(0, 10) ? liveCount : 0;
}

let activeCalls = 0;
const waitingCalls: (() => void)[] = [];

/** Runs `task` when one of the MAX_CONCURRENT slots is free. */
async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeCalls >= MAX_CONCURRENT) {
    // The finishing call hands its slot straight to us, so no increment here.
    await new Promise<void>((resolve) => waitingCalls.push(resolve));
  } else {
    activeCalls += 1;
  }
  try {
    return await task();
  } finally {
    const next = waitingCalls.shift();
    if (next) next();
    else activeCalls -= 1;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelay(response: Response, attempt: number): number {
  const header = Number(response.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return Math.min(header * 1000, 10_000);
  return RETRY_BASE_MS * 2 ** attempt + Math.floor(Math.random() * 250);
}

async function qlooGet(
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<{ data: Json; ms: number; sent: Record<string, string>; retries: number; saved: boolean }> {
  const sent: Record<string, string> = {};
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    sent[key] = String(value);
    url.searchParams.set(key, String(value));
  }

  // The saved demo example works without a key and without calling Qloo.
  const key = requestKey(path, sent);
  const saved = cache?.get(key);
  if (saved !== undefined) {
    return { data: asObject(saved), ms: 0, sent, retries: 0, saved: true };
  }

  const apiKey = process.env.QLOO_API_KEY;
  if (!apiKey) {
    throw new QlooError("QLOO_API_KEY is not set. Add it to .env.local.", null, 0, "no_key");
  }

  const started = Date.now();
  return withSlot(async () => {
    for (let attempt = 0; ; attempt += 1) {
      let response: Response;
      countLiveCall();
      try {
        response = await fetch(url, {
          headers: { "X-Api-Key": apiKey, Accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new QlooError(`Qloo request failed (${path}): ${reason}`);
      }

      const text = await response.text();
      const retryable = response.status === 429 || response.status === 503;
      if (retryable && attempt < MAX_RETRIES) {
        await sleep(retryDelay(response, attempt));
        continue;
      }
      if (!response.ok) {
        throw new QlooError(
          `Qloo returned ${response.status} for ${path}: ${text.trim().slice(0, 300)}`,
          response.status,
          attempt,
        );
      }

      let data: Json;
      try {
        data = asObject(JSON.parse(text));
      } catch {
        throw new QlooError(`Qloo returned non-JSON for ${path}`, response.status);
      }
      cache?.put?.(path, key, data);
      return { data, ms: Date.now() - started, sent, retries: attempt, saved: false };
    }
  });
}

// ---------- 1. Find artists ----------

/**
 * Search artists by name. Returns several candidates so the UI can ask the
 * user to confirm the right one before the agent runs.
 */
export async function searchArtists(
  query: string,
  take = 5,
  /** When given, the call is logged here for "How the agent got this". */
  calls?: QlooCall[],
): Promise<ArtistMatch[]> {
  const name = query.trim();
  if (!name) return [];

  const { data, ms, sent, retries, saved } = await qlooGet("/search", {
    query: name,
    types: "urn:entity:artist",
    take,
  });
  calls?.push({
    label: `Artist search: ${name}`,
    endpoint: "/search",
    params: sent,
    ms,
    resultCount: asArray(data.results).length,
    retries,
    saved,
  });

  const wanted = normalizeName(name);
  const matches: ArtistMatch[] = [];
  for (const item of asArray(data.results)) {
    const entity = asObject(item);
    const entityId = asString(entity.entity_id);
    const entityName = asString(entity.name);
    if (!entityId || !entityName) continue;
    const properties = asObject(entity.properties);
    matches.push({
      entityId,
      name: entityName,
      popularity: asNumber(entity.popularity),
      imageUrl: asString(asObject(properties.image).url),
      description:
        asString(properties.short_description) ??
        asString(entity.disambiguation),
      exactName: normalizeName(entityName) === wanted,
    });
  }
  return matches;
}

// ---------- 2. Genre as a fallback for missing artists ----------

/** Find music genre tags, e.g. "indie pop" -> urn:tag:genre:music:indie_pop. */
export async function searchGenreTags(
  query: string,
  take = 10,
  /** When given, the call is logged here for "How the agent got this". */
  calls?: QlooCall[],
): Promise<GenreTag[]> {
  const text = query.trim();
  if (!text) return [];

  const { data, ms, sent, retries, saved } = await qlooGet("/v2/tags", { "filter.query": text, take });
  calls?.push({
    label: `Genre lookup: ${text}`,
    endpoint: "/v2/tags",
    params: sent,
    ms,
    resultCount: asArray(asObject(data.results).tags).length,
    retries,
    saved,
  });

  const tags: GenreTag[] = [];
  for (const item of asArray(asObject(data.results).tags)) {
    const tag = asObject(item);
    const id = asString(tag.id);
    if (!id || !id.startsWith(MUSIC_TAG_PREFIX)) continue;
    tags.push({
      id,
      name: asString(tag.name) ?? humanize(id.slice(MUSIC_TAG_PREFIX.length)),
    });
  }
  return tags;
}

// ---------- 3. Brands per category, with score and reasons ----------

/**
 * Sponsor Fit Score, 0-95. This is our formula, not a Qloo number.
 *
 * Brands (see scoreBrandsAgainstEachOther): compared with the other brands
 * for the same crowd. Affinity alone could not be put on one fixed scale: an
 * artist line-up gives top brands 0.94-0.97, a genre gives 0.97-1.00 (stage 7
 * test, 18 Oct), so a fixed scale gave every genre search a wall of 95s.
 *
 * Local places: scored against each other the same way when at least
 * MIN_PLACES_TO_COMPARE have taste data; otherwise this function's fixed
 * scale, Qloo's affinity (80%) plus rank in its list (20%). Places at Qloo's
 * default affinity get no score at all; see PLACE_DEFAULT_AFFINITY.
 *
 * Both are capped at 95: nothing is a sure thing. Without an affinity the
 * affinity part sits mid-scale.
 */
const AFFINITY_SCALE = {
  brand: { low: 0.8, high: 0.975 },
  place: { low: 0.65, high: 0.96 },
} as const;
const MAX_FIT_SCORE = 95;
/** Below this, a category's #1 brand gets a note that the whole category is a smaller fit. */
const WEAK_TOP_SCORE = 80;

function fitScore(
  rank: number,
  listSize: number,
  source: "general" | "category",
  affinity: number | null,
  kind: "brand" | "place",
): number {
  const capacity = source === "general" ? GENERAL_TAKE : CATEGORY_TAKE;
  const rankPart = 1 - (rank - 1) / Math.max(listSize, capacity);
  const { low, high } = AFFINITY_SCALE[kind];
  const affinityPart = affinity === null ? 0.5 : Math.min(1, Math.max(0, (affinity - low) / (high - low)));
  return Math.min(MAX_FIT_SCORE, Math.round(100 * (0.8 * affinityPart + 0.2 * rankPart)));
}

/**
 * Rescores all brands of one search against each other:
 * score = 40 + 55 x (0.8 x affinity percentile + 0.2 x rank in its list), max 95.
 * The percentile is taken over every brand in the search (top 50 and all
 * category lists together), so categories can be compared and a weak
 * category's #1 does not look perfect. Percentile, not min-max: one outlier
 * does not squeeze everyone else (medians 65-68 on the six stage 7 tests,
 * at most one brand at 95).
 */
function scoreBrandsAgainstEachOther(brands: Brand[]): void {
  scoreAgainstEachOther(brands, (brand) => (brand.source === "general" ? GENERAL_TAKE : CATEGORY_TAKE));
}

/**
 * Shared by brands and local places: 40 + 55 x (0.8 x affinity percentile
 * within the group + 0.2 x rank in its own list), capped at 95.
 */
function scoreAgainstEachOther<T extends { affinity: number | null; rank: number; listSize: number; fitScore: number | null }>(
  items: T[],
  capacityOf: (item: T) => number,
): void {
  const affinities = items
    .map((item) => item.affinity)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  const percentile = (value: number | null): number => {
    if (value === null || affinities.length < 2) return 0.5;
    const below = affinities.filter((other) => other < value).length;
    const same = affinities.filter((other) => other === value).length;
    return (below + (same - 1) / 2) / (affinities.length - 1);
  };
  for (const item of items) {
    const rankPart = 1 - (item.rank - 1) / Math.max(item.listSize, capacityOf(item));
    const mix = 0.8 * percentile(item.affinity) + 0.2 * rankPart;
    item.fitScore = Math.min(MAX_FIT_SCORE, Math.round(40 + 55 * mix));
  }
}

/** Below this many places with taste data, places keep the fixed scale. */
const MIN_PLACES_TO_COMPARE = 5;

function readReasons(
  entity: Json,
  signalNames: Map<string, string>,
): BrandReason[] {
  const explainability = asObject(asObject(entity.query).explainability);
  const raw: { id: string; score: number }[] = [];

  for (const item of asArray(explainability["signal.interests.entities"])) {
    const row = asObject(item);
    const id = asString(row.entity_id);
    const score = asNumber(row.score);
    if (id && score !== null) raw.push({ id, score });
  }
  for (const item of asArray(explainability["signal.interests.tags"])) {
    const row = asObject(item);
    const id = asString(row.tag_id) ?? asString(row.id);
    const score = asNumber(row.score);
    if (id && score !== null) raw.push({ id, score });
  }

  const total = raw.reduce((sum, row) => sum + Math.max(row.score, 0), 0);
  return raw
    .map((row) => ({
      id: row.id,
      name: signalNames.get(row.id) ?? row.id,
      score: row.score,
      share: total > 0 ? Math.max(row.score, 0) / total : 0,
    }))
    .sort((a, b) => b.score - a.score);
}

// Real data (10 Oct, three indie artists): Qloo's explainability scores are
// shares that add up to 1, and for a line-up of similar artists they sit close
// to equal (top minus bottom: median 3 points, max 9). So only call out an
// artist when their share is clearly above an equal split.
const LEAN_MARGIN = 0.03;

function reasonSentence(
  reasons: BrandReason[],
  rank: number,
  listSize: number,
  source: "general" | "category",
  categoryLabel: string,
  /** Word after the category, e.g. "brands". Empty for places ("cafes"). */
  noun = "brands",
): string {
  const things = noun ? `${categoryLabel.toLowerCase()} ${noun}` : categoryLabel.toLowerCase();
  const rankPart =
    source === "general"
      ? // The general list spans every category, so say so: under "Electronics (1)" a
        // bare "#4 of 46" read as if there were 46 electronics brands.
        `#${rank} of ${listSize} brands Qloo matched to this crowd, across all categories.`
      : `#${rank} of ${listSize} ${things} for this crowd.`;

  const strong = reasons.filter((reason) => reason.share > 0);
  if (strong.length === 0) return rankPart;
  if (strong.length === 1) return `${rankPart} Matched through fans of ${strong[0].name}.`;

  const top = strong[0];
  if (top.share - 1 / strong.length >= LEAN_MARGIN) {
    // Name only; the share stays internal (no percentages anywhere in the UI or PDF).
    return `${rankPart} Leans toward ${top.name} fans.`;
  }
  // No artist stands out: the rank says enough. Repeating "liked evenly" on
  // every row only added noise.
  return rankPart;
}

function brandTagIds(entity: Json): string[] {
  const ids: string[] = [];
  for (const item of asArray(entity.tags)) {
    const id = asString(asObject(item).id);
    if (id && id.startsWith(BRAND_TAG_PREFIX)) ids.push(id);
  }
  return ids;
}

/** Category for a brand from the general list, read from its own tags. */
function categoryFromTags(tagIds: string[]): { id: string; label: string } {
  for (const category of SPONSOR_CATEGORIES) {
    if (tagIds.some((id) => id === category.tag || id.startsWith(`${category.tag}:`))) {
      return { id: category.id, label: category.label };
    }
  }
  if (tagIds.length === 0) return { id: "other", label: "Other" };
  const top = tagIds[0].slice(BRAND_TAG_PREFIX.length).split(":")[0];
  return { id: top, label: humanize(top) };
}

function toBrand(
  entity: Json,
  category: { id: string; label: string },
  rank: number,
  listSize: number,
  source: "general" | "category",
  signalNames: Map<string, string>,
): Brand | null {
  const entityId = asString(entity.entity_id);
  const name = asString(entity.name);
  if (!entityId || !name) return null;

  const properties = asObject(entity.properties);
  const reasons = readReasons(entity, signalNames);
  return {
    entityId,
    name,
    categoryId: category.id,
    fitScore: fitScore(rank, listSize, source, asNumber(asObject(entity.query).affinity), "brand"),
    rank,
    listSize,
    source,
    affinity: asNumber(asObject(entity.query).affinity),
    popularity: asNumber(entity.popularity),
    imageUrl: asString(asObject(properties.image).url),
    description: asString(properties.short_description),
    reasons,
    reasonText: reasonSentence(reasons, rank, listSize, source, category.label),
    alcohol:
      brandTagIds(entity).some((id) => id.startsWith(ALCOHOL_TAG_PREFIX)) ||
      SPONSOR_CATEGORIES.some((sponsor) => sponsor.id === category.id && sponsor.alcohol),
  };
}

/**
 * Brands this crowd already likes, grouped by category. Runs one general
 * query plus one query per sponsor category, all in parallel.
 */
export async function getSponsorBrands(
  input: SponsorBrandsInput,
): Promise<SponsorBrandsResult> {
  const artists = input.artists ?? [];
  const genreTags = input.genreTags ?? [];
  if (artists.length === 0 && genreTags.length === 0) {
    throw new QlooError("Give at least one artist or one genre.");
  }

  const signalNames = new Map<string, string>();
  for (const artist of artists) signalNames.set(artist.entityId, artist.name);
  for (const tag of genreTags) signalNames.set(tag.id, tag.name);

  const city = input.city?.trim() || undefined;
  const paramsFor = (useCity: boolean): Record<string, string | number | undefined> => ({
    "filter.type": "urn:entity:brand",
    "signal.interests.entities":
      artists.map((artist) => artist.entityId).join(",") || undefined,
    "signal.interests.tags": genreTags.map((tag) => tag.id).join(",") || undefined,
    "signal.location.query": useCity ? city : undefined,
    "signal.demographics.age": input.age,
    "feature.explainability": "true",
  });

  const includeAlcohol = input.includeAlcohol ?? false;
  const categories = SPONSOR_CATEGORIES.filter(
    (category) => includeAlcohol || !category.alcohol,
  );

  const calls: QlooCall[] = [];

  async function fetchBrands(
    label: string,
    base: Record<string, string | number | undefined>,
    extra: Record<string, string | number>,
    required: boolean,
  ): Promise<Json[]> {
    const params = { ...base, ...extra };
    const started = Date.now();
    try {
      const { data, ms, sent, retries, saved } = await qlooGet("/v2/insights", params);
      const entities = asArray(asObject(data.results).entities).map(asObject);
      calls.push({
        label,
        endpoint: "/v2/insights",
        params: sent,
        ms,
        resultCount: entities.length,
        retries,
        saved,
      });
      return entities;
    } catch (error) {
      if (required) throw error;
      // One failed category should not sink the whole result. The call log
      // goes to the browser, so the real error stays in the server log.
      console.error(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      calls.push({
        label,
        endpoint: "/v2/insights",
        params: {},
        ms: Date.now() - started,
        resultCount: 0,
        retries: error instanceof QlooError ? error.retries : 0,
        error: CALL_FAILED,
      });
      return [];
    }
  }

  const runRound = (useCity: boolean, suffix: string) =>
    Promise.all([
      fetchBrands(`Top brands for this crowd${suffix}`, paramsFor(useCity), { take: GENERAL_TAKE }, true),
      ...categories.map((category) =>
        fetchBrands(
          `${category.label} brands${suffix}`,
          paramsFor(useCity),
          { "filter.tags": category.tag, take: CATEGORY_TAKE },
          false,
        ),
      ),
    ]);

  input.onStep?.("brands");
  let lists = await runRound(Boolean(city), "");
  let cityDropped = false;
  // Qloo returns no brands at all, and no error, for a place it has no taste
  // data for. "Indio, CA" gave zero in every category (11 Oct). Small towns are
  // exactly where our users are, so fall back to the line-up alone and say so.
  if (city && lists.every((list) => list.length === 0)) {
    input.onStep?.("brands-without-city");
    const retry = await runRound(false, " (line-up only)");
    if (retry.some((list) => list.length > 0)) {
      lists = retry;
      cityDropped = true;
    }
  }
  const [general, ...perCategory] = lists;

  // Keep the best-scoring copy when a brand shows up in more than one list.
  const best = new Map<string, Brand>();
  const labels = new Map<string, string>();

  function keep(brand: Brand | null, label: string) {
    if (!brand) return;
    labels.set(brand.categoryId, label);
    const existing = best.get(brand.entityId);
    if (!existing || brand.fitScore > existing.fitScore) {
      best.set(brand.entityId, brand);
    }
  }

  // Filter first, then number: "#3 of 38" counts only brands we show, so the
  // rank in the reason, the pitch, the one-pager and the score all agree.
  const shown = (entities: Json[]) =>
    entities.filter((entity) => {
      const tagIds = brandTagIds(entity);
      if (notASponsor(tagIds)) return false;
      return includeAlcohol || !tagIds.some((id) => id.startsWith(ALCOHOL_TAG_PREFIX));
    });

  const generalShown = shown(general);
  generalShown.forEach((entity, index) => {
    const category = categoryFromTags(brandTagIds(entity));
    keep(
      toBrand(entity, category, index + 1, generalShown.length, "general", signalNames),
      category.label,
    );
  });

  perCategory.forEach((entities, categoryIndex) => {
    const category = categories[categoryIndex];
    const categoryShown = shown(entities);
    categoryShown.forEach((entity, index) => {
      keep(
        toBrand(entity, category, index + 1, categoryShown.length, "category", signalNames),
        category.label,
      );
    });
  });

  // The copy kept above was picked with the fixed-scale score; the score
  // shown is relative to every other brand in this search.
  scoreBrandsAgainstEachOther([...best.values()]);

  const grouped = new Map<string, Brand[]>();
  for (const brand of best.values()) {
    const list = grouped.get(brand.categoryId) ?? [];
    list.push(brand);
    grouped.set(brand.categoryId, list);
  }

  const result: BrandCategory[] = [...grouped.entries()].map(([id, brands]) => ({
    id,
    label: labels.get(id) ?? humanize(id),
    brands: brands.sort((a, b) => b.fitScore - a.fitScore || a.rank - b.rank),
  }));

  // A category's #1 can still be a modest fit. Say so, instead of letting
  // "#1 of 15" read like a perfect match next to a lower score. Compared with
  // the category whose best brand scores highest, whatever the card order.
  const strongest = result
    .filter((category) => category.id !== "other")
    .sort((a, b) => b.brands[0].fitScore - a.brands[0].fitScore)[0];

  // Card order: the categories that usually sponsor events first, then the
  // rest, then media-like categories, then "Other". Inside each group the
  // category with the best top brand comes first. Nothing is dropped.
  const groupOf = (id: string) => {
    if (MAIN_SPONSOR_CATEGORIES.includes(id)) return 0;
    if (id === "other") return 3;
    return LOW_CATEGORIES.includes(id) ? 2 : 1;
  };
  result.sort(
    (a, b) =>
      groupOf(a.id) - groupOf(b.id) ||
      b.brands[0].fitScore - a.brands[0].fitScore ||
      b.brands.length - a.brands.length,
  );
  for (const category of result) {
    const top = category.brands[0];
    if (!strongest || category === strongest || category.id === "other" || top.fitScore >= WEAK_TOP_SCORE) continue;
    top.reasonText += ` Top pick among ${category.label.toLowerCase()} brands, a smaller fit for this crowd than the top ${strongest.label.toLowerCase()} brands.`;
  }

  return { categories: result, calls, cityDropped };
}

// ---------- 3. Local sponsors (places) ----------
//
// Tested 10 Oct (scripts/try-places.mjs, indie line-up, Austin):
// - Every place has location.lat/lon, properties.address, business_rating, and
//   most have price_level and website. One call takes 0.5-1.1 s.
// - filter.location.radius does nothing with a city name in
//   filter.location.query: the same list comes back with or without it, and a
//   few results sit outside the city (Buda, Southwest Pkwy). So the distance
//   filter is done here, around the middle of the results.
// - The generic restaurant tag returns mostly bars and music venues, so it is
//   not used.
// - Chains show up more than once (Urban Outfitters x2, REI x2): keep one.

const PLACE_TAKE = 15;
/**
 * Qloo's affinity for a place when it has little taste data for it: exactly
 * 0.7649962877984056 on 89 of 154 places in the stage 7 test (18 Oct; every
 * place in Ithaca, NY). Places at or below it get no score.
 */
const PLACE_DEFAULT_AFFINITY = 0.7649962877984056;
/** City-name searches: places farther than this from the middle of the results are dropped. */
const MAX_PLACE_DISTANCE_KM = 20;

export interface PlaceCategoryDef {
  id: string;
  label: string;
  tag: string;
  /** Bars only show for 21+ events, like alcohol brands. */
  alcohol: boolean;
}

export const PLACE_CATEGORIES: readonly PlaceCategoryDef[] = [
  { id: "cafes", label: "Cafes", tag: "urn:tag:genre:place:restaurant:cafe", alcohol: false },
  { id: "clothing", label: "Clothing stores", tag: "urn:tag:category:place:clothing_store", alcohol: false },
  { id: "bars", label: "Bars", tag: "urn:tag:genre:place:restaurant:bar", alcohol: true },
];

export interface LocalPlace {
  entityId: string;
  name: string;
  categoryId: string;
  categoryLabel: string;
  lat: number;
  lon: number;
  /** Straight-line distance from the middle of all results, km. */
  distanceKm: number;
  address: string | null;
  neighborhood: string | null;
  website: string | null;
  phone: string | null;
  rating: number | null;
  /** 1-4, like $ to $$$$. */
  priceLevel: number | null;
  imageUrl: string | null;
  description: string | null;
  /** Null when Qloo has little taste data for the place (see littleData). */
  fitScore: number | null;
  /** Qloo's affinity sits at its default value: listed by distance, no score. */
  littleData: boolean;
  rank: number;
  listSize: number;
  affinity: number | null;
  reasons: BrandReason[];
  reasonText: string;
}

export interface LocalSponsorsInput {
  artists?: { entityId: string; name: string }[];
  genreTags?: GenreTag[];
  /** Required: places are searched in this city. */
  city: string;
  age?: AgeGroup;
  /** True only for 21+ events. Adds bars. */
  includeBars?: boolean;
  /** The city's coordinates and search radius, when it was picked from the US list. */
  point?: { lat: number; lon: number; radiusKm: number };
}

export interface LocalSponsorsResult {
  places: LocalPlace[];
  /** Middle of the kept places, for centering the map. Null when nothing was found. */
  center: { lat: number; lon: number } | null;
  /** Places dropped for being too far from the middle. */
  droppedFar: number;
  /** Duplicate chain branches dropped. */
  droppedDuplicates: number;
  calls: QlooCall[];
  /** How the places were searched: by the city's point and radius, or by its name. */
  search: { by: "point" | "city"; radiusKm: number | null; widened: boolean };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Qloo sends ratings as floats like 4.699999809265137. */
function roundRating(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

function toPlace(
  entity: Json,
  category: PlaceCategoryDef,
  rank: number,
  listSize: number,
  signalNames: Map<string, string>,
): Omit<LocalPlace, "distanceKm"> | null {
  const entityId = asString(entity.entity_id);
  const name = asString(entity.name);
  const location = asObject(entity.location);
  const lat = asNumber(location.lat);
  const lon = asNumber(location.lon);
  if (!entityId || !name || lat === null || lon === null) return null;

  const props = asObject(entity.properties);
  if (props.is_closed === true) return null;

  const reasons = readReasons(entity, signalNames);
  const firstImage = asObject(asArray(props.images)[0]);
  const affinity = asNumber(asObject(entity.query).affinity);
  const littleData = affinity !== null && affinity <= PLACE_DEFAULT_AFFINITY + 1e-9;
  return {
    entityId,
    name,
    categoryId: category.id,
    categoryLabel: category.label,
    lat,
    lon,
    address: asString(props.address),
    neighborhood: asString(asObject(props.geocode).name),
    website: asString(props.website),
    phone: asString(props.phone),
    rating: roundRating(asNumber(props.business_rating)),
    priceLevel: asNumber(props.price_level),
    imageUrl: asString(firstImage.url),
    description: asString(props.short_description) ?? asString(props.description),
    fitScore: littleData ? null : fitScore(rank, listSize, "category", affinity, "place"),
    littleData,
    rank,
    listSize,
    affinity: asNumber(asObject(entity.query).affinity),
    reasons,
    reasonText: reasonSentence(reasons, rank, listSize, "category", category.label, ""),
  };
}

/** Below this many places, a POINT search is tried once more with twice the radius. */
const MIN_PLACES = 6;
const MAX_PLACE_RADIUS_KM = 30;

/**
 * Local businesses near the event that this crowd likes: one Qloo call per
 * place category, in parallel. A failed category is logged and skipped.
 *
 * With `point` (a city picked from the US list), places are searched by
 * POINT + radius, which Qloo honors (scripts/probe-form.mjs, 16 Oct: 3 km
 * radius -> every place within 2.7 km). With fewer than MIN_PLACES results the
 * search runs once more with twice the radius, up to MAX_PLACE_RADIUS_KM.
 * Without `point` (a typed city), the city name is used and far results are
 * cut around the median, as before.
 */
export async function getLocalSponsors(
  input: LocalSponsorsInput,
): Promise<LocalSponsorsResult> {
  const artists = input.artists ?? [];
  const genreTags = input.genreTags ?? [];
  const city = input.city.trim();
  if (!city) throw new QlooError("A city is needed to find local sponsors.");
  if (artists.length === 0 && genreTags.length === 0) {
    throw new QlooError("Give at least one artist or one genre.");
  }

  const signalNames = new Map<string, string>();
  for (const artist of artists) signalNames.set(artist.entityId, artist.name);
  for (const tag of genreTags) signalNames.set(tag.id, tag.name);

  const categories = PLACE_CATEGORIES.filter(
    (category) => input.includeBars || !category.alcohol,
  );
  const calls: QlooCall[] = [];
  // Rethrown when every call fails, so the route still sees why (no key, 429...).
  let firstError: unknown = null;

  async function runRound(radiusKm: number | null) {
    const where =
      input.point && radiusKm !== null
        ? {
            "filter.location": `POINT(${input.point.lon} ${input.point.lat})`,
            "filter.location.radius": radiusKm * 1000,
          }
        : { "filter.location.query": city };
    const lists = await Promise.all(
      categories.map(async (category) => {
        const label =
          radiusKm !== null
            ? `${category.label} within ${radiusKm} km of ${city}`
            : `${category.label} near ${city}`;
        const started = Date.now();
        try {
          const { data, ms, sent, retries, saved } = await qlooGet("/v2/insights", {
            "filter.type": "urn:entity:place",
            ...where,
            "filter.tags": category.tag,
            "signal.interests.entities":
              artists.map((artist) => artist.entityId).join(",") || undefined,
            "signal.interests.tags": genreTags.map((tag) => tag.id).join(",") || undefined,
            "signal.demographics.age": input.age,
            "feature.explainability": "true",
            take: PLACE_TAKE,
          });
          const entities = asArray(asObject(data.results).entities).map(asObject);
          calls.push({ label, endpoint: "/v2/insights", params: sent, ms, resultCount: entities.length, retries, saved });
          return entities;
        } catch (error) {
          // The call log goes to the browser, so the real error stays in the server log.
          console.error(`${label}: ${error instanceof Error ? error.message : String(error)}`);
          firstError ??= error;
          calls.push({
            label,
            endpoint: "/v2/insights",
            params: {},
            ms: Date.now() - started,
            resultCount: 0,
            retries: error instanceof QlooError ? error.retries : 0,
            error: CALL_FAILED,
          });
          return [];
        }
      }),
    );

    // Same place in two categories -> keep the better score. Same chain name ->
    // keep the first (higher-ranked) branch.
    const byId = new Map<string, Omit<LocalPlace, "distanceKm">>();
    lists.forEach((entities, index) => {
      const category = categories[index];
      entities.forEach((entity, position) => {
        const place = toPlace(entity, category, position + 1, entities.length, signalNames);
        if (!place) return;
        const existing = byId.get(place.entityId);
        if (!existing || (place.fitScore ?? -1) > (existing.fitScore ?? -1)) byId.set(place.entityId, place);
      });
    });

    const sorted = [...byId.values()].sort((a, b) => (b.fitScore ?? -1) - (a.fitScore ?? -1) || a.rank - b.rank);
    const seenNames = new Set<string>();
    const unique = sorted.filter((place) => {
      const key = normalizeName(place.name);
      if (seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    });
    return { lists, unique, droppedDuplicates: sorted.length - unique.length };
  }

  let radiusKm = input.point ? input.point.radiusKm : null;
  let round = await runRound(radiusKm);
  let widened = false;
  if (input.point && radiusKm !== null && round.unique.length < MIN_PLACES) {
    const wider = Math.min(radiusKm * 2, MAX_PLACE_RADIUS_KM);
    if (wider > radiusKm) {
      radiusKm = wider;
      round = await runRound(radiusKm);
      widened = true;
    }
  }

  const failed = calls.filter((call) => call.error).length;
  if (round.lists.every((list) => list.length === 0) && failed === calls.length) {
    throw firstError instanceof QlooError ? firstError : new QlooError("Qloo place search failed");
  }

  const search = { by: input.point ? ("point" as const) : ("city" as const), radiusKm, widened };
  const { unique, droppedDuplicates } = round;
  if (unique.length === 0) {
    return { places: [], center: null, droppedFar: 0, droppedDuplicates, calls, search };
  }

  // A POINT search is measured from the city's own point and Qloo already kept
  // to the radius. A city-name search is measured from the median, which a few
  // far-off results cannot pull away.
  const middle = input.point ?? {
    lat: median(unique.map((place) => place.lat)),
    lon: median(unique.map((place) => place.lon)),
  };
  const limitKm = radiusKm ?? MAX_PLACE_DISTANCE_KM;
  const withDistance: LocalPlace[] = unique.map((place) => ({
    ...place,
    distanceKm: Math.round(distanceKm(middle.lat, middle.lon, place.lat, place.lon) * 10) / 10,
  }));
  const kept = withDistance.filter((place) => place.distanceKm <= limitKm);

  // With enough places that have taste data, score them against each other,
  // like brands; the fixed place scale gave big cities a row of 95s (stage 7,
  // 18 Oct). Places with little taste data never take part.
  const withData = kept.filter((place) => !place.littleData);
  if (withData.length >= MIN_PLACES_TO_COMPARE) scoreAgainstEachOther(withData, () => PLACE_TAKE);

  // Scored places first, best first; then places with little taste data, nearest first.
  const places = kept.sort((a, b) =>
    a.littleData !== b.littleData
      ? Number(a.littleData) - Number(b.littleData)
      : a.littleData
        ? a.distanceKm - b.distanceKm
        : (b.fitScore ?? 0) - (a.fitScore ?? 0) || a.rank - b.rank,
  );

  const center =
    places.length > 0
      ? {
          lat: places.reduce((sum, place) => sum + place.lat, 0) / places.length,
          lon: places.reduce((sum, place) => sum + place.lon, 0) / places.length,
        }
      : null;

  return {
    places,
    center,
    droppedFar: withDistance.length - places.length,
    droppedDuplicates,
    calls,
    search,
  };
}
