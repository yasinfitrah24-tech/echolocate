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
// - entity.query.affinity is flat (0.95-0.97), so the Sponsor Fit Score is
//   computed here from ranking instead.

const BASE_URL = "https://hackathon.api.qloo.com";
const TIMEOUT_MS = 20_000;
const MAX_CONCURRENT = 3;
const MAX_RETRIES = 4;
const RETRY_BASE_MS = 500;
const BRAND_TAG_PREFIX = "urn:tag:genre:brand:";
const MUSIC_TAG_PREFIX = "urn:tag:genre:music:";
const NGO_TAG_PREFIX = "urn:tag:genre:brand:ngo";
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
  /** Sponsor Fit Score, 0-100. Our own formula, see fitScore(). */
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
  error?: string;
}

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
}

export interface SponsorBrandsResult {
  categories: BrandCategory[];
  calls: QlooCall[];
}

export class QlooError extends Error {
  status: number | null;
  /** Retries already spent before giving up. */
  retries: number;

  constructor(message: string, status: number | null = null, retries = 0) {
    super(message);
    this.name = "QlooError";
    this.status = status;
    this.retries = retries;
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
): Promise<{ data: Json; ms: number; sent: Record<string, string>; retries: number }> {
  const apiKey = process.env.QLOO_API_KEY;
  if (!apiKey) {
    throw new QlooError("QLOO_API_KEY is not set. Add it to .env.local.");
  }

  const sent: Record<string, string> = {};
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    sent[key] = String(value);
    url.searchParams.set(key, String(value));
  }

  const started = Date.now();
  return withSlot(async () => {
    for (let attempt = 0; ; attempt += 1) {
      let response: Response;
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

      try {
        return {
          data: asObject(JSON.parse(text)),
          ms: Date.now() - started,
          sent,
          retries: attempt,
        };
      } catch {
        throw new QlooError(`Qloo returned non-JSON for ${path}`, response.status);
      }
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
): Promise<ArtistMatch[]> {
  const name = query.trim();
  if (!name) return [];

  const { data } = await qlooGet("/search", {
    query: name,
    types: "urn:entity:artist",
    take,
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
): Promise<GenreTag[]> {
  const text = query.trim();
  if (!text) return [];

  const { data } = await qlooGet("/v2/tags", { "filter.query": text, take });

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
 * Sponsor Fit Score, 0-100. This is our formula, not a Qloo number.
 *
 * - Rank (75%): position in the Qloo list, measured against the size we asked
 *   for (so #3 of a short list is still a strong match). A brand in the
 *   general top-50 never drops below half, because it already beat every
 *   other brand category to get there.
 * - Line-up support (25%): how evenly the line-up drives the match. A brand
 *   every artist's fans like beats one carried by a single artist. Only used
 *   when there are two or more signals.
 */
function fitScore(
  rank: number,
  listSize: number,
  source: "general" | "category",
  reasons: BrandReason[],
): number {
  const capacity = source === "general" ? GENERAL_TAKE : CATEGORY_TAKE;
  let rankPart = 1 - (rank - 1) / Math.max(listSize, capacity);
  if (source === "general") rankPart = 0.5 + 0.5 * rankPart;

  if (reasons.length < 2) return Math.round(100 * rankPart);

  const scores = reasons.map((reason) => Math.max(reason.score, 0));
  const max = Math.max(...scores);
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const support = max > 0 ? mean / max : 1;
  return Math.round(100 * (0.75 * rankPart + 0.25 * support));
}

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
): string {
  const rankPart =
    source === "general"
      ? `#${rank} of the top ${listSize} brands for this crowd, across all categories.`
      : `#${rank} of ${listSize} ${categoryLabel.toLowerCase()} brands for this crowd.`;

  const strong = reasons.filter((reason) => reason.share > 0);
  if (strong.length === 0) return rankPart;
  if (strong.length === 1) return `${rankPart} Matched through fans of ${strong[0].name}.`;

  const top = strong[0];
  if (top.share - 1 / strong.length >= LEAN_MARGIN) {
    return `${rankPart} Leans toward ${top.name} fans (${Math.round(top.share * 100)}% of the match).`;
  }
  return `${rankPart} Liked evenly across the line-up.`;
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
    fitScore: fitScore(rank, listSize, source, reasons),
    rank,
    listSize,
    source,
    affinity: asNumber(asObject(entity.query).affinity),
    popularity: asNumber(entity.popularity),
    imageUrl: asString(asObject(properties.image).url),
    description: asString(properties.short_description),
    reasons,
    reasonText: reasonSentence(reasons, rank, listSize, source, category.label),
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

  const baseParams: Record<string, string | number | undefined> = {
    "filter.type": "urn:entity:brand",
    "signal.interests.entities":
      artists.map((artist) => artist.entityId).join(",") || undefined,
    "signal.interests.tags": genreTags.map((tag) => tag.id).join(",") || undefined,
    "signal.location.query": input.city?.trim() || undefined,
    "signal.demographics.age": input.age,
    "feature.explainability": "true",
  };

  const includeAlcohol = input.includeAlcohol ?? false;
  const categories = SPONSOR_CATEGORIES.filter(
    (category) => includeAlcohol || !category.alcohol,
  );

  const calls: QlooCall[] = [];

  async function fetchBrands(
    label: string,
    extra: Record<string, string | number>,
    required: boolean,
  ): Promise<Json[]> {
    const params = { ...baseParams, ...extra };
    const started = Date.now();
    try {
      const { data, ms, sent, retries } = await qlooGet("/v2/insights", params);
      const entities = asArray(asObject(data.results).entities).map(asObject);
      calls.push({
        label,
        endpoint: "/v2/insights",
        params: sent,
        ms,
        resultCount: entities.length,
        retries,
      });
      return entities;
    } catch (error) {
      if (required) throw error;
      // One failed category should not sink the whole result.
      calls.push({
        label,
        endpoint: "/v2/insights",
        params: {},
        ms: Date.now() - started,
        resultCount: 0,
        retries: error instanceof QlooError ? error.retries : 0,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  const [general, ...perCategory] = await Promise.all([
    fetchBrands("Top brands for this crowd", { take: GENERAL_TAKE }, true),
    ...categories.map((category) =>
      fetchBrands(
        `${category.label} brands`,
        { "filter.tags": category.tag, take: CATEGORY_TAKE },
        false,
      ),
    ),
  ]);

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

  general.forEach((entity, index) => {
    const tagIds = brandTagIds(entity);
    // Advocacy groups come back as "brands" (e.g. Black Lives Matter). Not sponsors.
    if (tagIds.some((id) => id.startsWith(NGO_TAG_PREFIX))) return;
    if (!includeAlcohol && tagIds.some((id) => id.startsWith(ALCOHOL_TAG_PREFIX))) return;
    const category = categoryFromTags(tagIds);
    keep(
      toBrand(entity, category, index + 1, general.length, "general", signalNames),
      category.label,
    );
  });

  perCategory.forEach((entities, categoryIndex) => {
    const category = categories[categoryIndex];
    entities.forEach((entity, index) => {
      const tagIds = brandTagIds(entity);
      if (tagIds.some((id) => id.startsWith(NGO_TAG_PREFIX))) return;
      if (!includeAlcohol && tagIds.some((id) => id.startsWith(ALCOHOL_TAG_PREFIX))) return;
      keep(
        toBrand(entity, category, index + 1, entities.length, "category", signalNames),
        category.label,
      );
    });
  });

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

  // Strongest category first; "Other" always last.
  result.sort((a, b) => {
    if (a.id === "other") return 1;
    if (b.id === "other") return -1;
    return b.brands[0].fitScore - a.brands[0].fitScore || b.brands.length - a.brands.length;
  });

  return { categories: result, calls };
}
