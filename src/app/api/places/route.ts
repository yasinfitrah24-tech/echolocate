// POST /api/places
// Local businesses near the event that this crowd likes, for the map.
// The UI calls this after /api/brands, with the artists and genre tags that
// route already confirmed, so no name lookups happen here.
//
// Body (JSON):
//   artists?: { entityId: string; name: string }[]
//   genreTags?: { id: string; name: string }[]
//   city: string                       e.g. "Austin, TX" (required). A city from the US
//                                      list is searched by its point and a radius from its
//                                      population; any other text by name, as before.
//   age?: an id from AUDIENCE_AGES
//   admission?: "all_ages" | "18_plus" | "21_plus"   bars only for 21_plus

import { NextResponse } from "next/server";
import { DEFAULT_ADMISSION, findAdmission, findAudienceAge } from "@/lib/audience";
import { getLocalSponsors, type GenreTag } from "@/lib/qloo";
import { publicQlooFailure } from "@/lib/public-errors";
import { findUsCity, placeRadiusKm } from "@/lib/us-cities";
import { isSavedExample, savedAt } from "@/lib/demo-recording";
import { blockLiveSearch } from "@/lib/rate-limit";

const MAX_SIGNALS = 8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= maxLength ? text : null;
}

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function readPairs(
  value: unknown,
  idKey: "entityId" | "id",
): { id: string; name: string }[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const out: { id: string; name: string }[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const id = cleanText(item[idKey], 100);
    const name = cleanText(item.name, 100);
    if (!id || !name) return null;
    if (!out.some((pair) => pair.id === id)) out.push({ id, name });
  }
  return out;
}

export async function POST(request: Request) {
  const started = Date.now();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("Body must be JSON");
  }
  if (!isRecord(body)) return bad("Body must be a JSON object");

  const artists = readPairs(body.artists, "entityId");
  if (!artists) return bad("artists must be a list of { entityId, name }");
  const tags = readPairs(body.genreTags, "id");
  if (!tags) return bad("genreTags must be a list of { id, name }");
  if (artists.length + tags.length === 0) return bad("Give at least one artist or genre tag");
  if (artists.length + tags.length > MAX_SIGNALS) return bad(`Use at most ${MAX_SIGNALS} artists and tags`);

  const city = cleanText(body.city, 100);
  if (!city) return bad("city is required");

  const audience =
    body.age === undefined || body.age === null || body.age === "" ? null : findAudienceAge(body.age);
  if (body.age && !audience) return bad("Unknown age group");

  const admission =
    body.admission === undefined || body.admission === null || body.admission === ""
      ? DEFAULT_ADMISSION
      : findAdmission(body.admission);
  if (!admission) return bad("Unknown admission");

  const usCity = findUsCity(city);

  // Exact match, like /api/brands: the saved answers are for these exact values.
  const example = isSavedExample("places", {
    artists: artists.map((artist) => artist.id),
    genreTags: tags.map((tag) => tag.id),
    city,
    age: audience?.id ?? null,
    admission: admission.id,
  });
  if (!example) {
    const blocked = blockLiveSearch(request, "places");
    if (blocked) return blocked;
  }

  try {
    const result = await getLocalSponsors({
      artists: artists.map((artist) => ({ entityId: artist.id, name: artist.name })),
      genreTags: tags as GenreTag[],
      city,
      age: audience?.id,
      includeBars: admission.alcoholAllowed,
      point: usCity
        ? { lat: usCity.lat, lon: usCity.lon, radiusKm: placeRadiusKm(usCity.population) }
        : undefined,
    });
    return NextResponse.json({
      input: {
        city,
        age: audience?.id ?? null,
        admission: admission.id,
        barsIncluded: admission.alcoholAllowed,
        // From the US city list; null for a typed city that is not in it.
        cityPopulation: usCity?.population ?? null,
      },
      ...result,
      savedExample: example && result.calls.every((call) => call.saved) ? savedAt : null,
      tookMs: Date.now() - started,
    });
  } catch (error) {
    // Upstream error text stays in the server log; the browser gets a short message.
    const failure = publicQlooFailure(error, "/api/places");
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
