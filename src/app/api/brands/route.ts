// POST /api/brands
// Body (JSON):
//   artistNames?: string[]                       typed names, resolved here
//   artists?: { entityId: string; name: string }[]   already confirmed in the UI
//   genreTagId?: string                          a tagId from src/data/music-genres.json (no Qloo search needed)
//   genre?: string                               free text, e.g. "shoegaze"; looked up in Qloo when genreTagId is not given
//   city?: string                                e.g. "Austin, TX"
//   age?: an id from AUDIENCE_AGES, e.g. "24_and_younger"   (who mostly comes)
//   admission?: "all_ages" | "18_plus" | "21_plus"            (who is allowed in; default all_ages)
//   includeAlcohol?: boolean                     default false; only honored for 21_plus
//
// Returns brands grouped by category with a Sponsor Fit Score and reasons,
// plus `unresolved` names the UI should ask the user about, and `genreMatch`
// (which Qloo genre a typed genre became, or null when none was found).

import { NextResponse } from "next/server";
import {
  ADMISSIONS,
  AUDIENCE_AGES,
  DEFAULT_ADMISSION,
  findAdmission,
  findAudienceAge,
  type Admission,
  type AudienceAge,
} from "@/lib/audience";
import { savedExampleAt } from "@/lib/demo-recording";
import { findGenreByTagId } from "@/lib/genres";
import { blockLiveSearch } from "@/lib/rate-limit";
import { publicQlooFailure } from "@/lib/public-errors";
import {
  getSponsorBrands,
  searchArtists,
  searchGenreTags,
  type ArtistMatch,
  type GenreTag,
  type QlooCall,
} from "@/lib/qloo";

/** Progress steps sent to the page while a live search runs. */
type SearchStep = "artists" | "genre" | "brands" | "brands-without-city";

const MAX_ARTISTS = 5;

interface ConfirmedArtist {
  entityId: string;
  name: string;
}

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

export async function POST(request: Request) {
  const started = Date.now();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("Body must be JSON");
  }
  if (!isRecord(body)) return bad("Body must be a JSON object");

  // ----- read and check the input -----
  const artistNames: string[] = [];
  if (body.artistNames !== undefined) {
    if (!Array.isArray(body.artistNames)) return bad("artistNames must be a list");
    for (const item of body.artistNames) {
      const name = cleanText(item, 100);
      if (name && !artistNames.some((n) => n.toLowerCase() === name.toLowerCase())) {
        artistNames.push(name);
      }
    }
  }

  const confirmed: ConfirmedArtist[] = [];
  if (body.artists !== undefined) {
    if (!Array.isArray(body.artists)) return bad("artists must be a list");
    for (const item of body.artists) {
      if (!isRecord(item)) return bad("Each artist needs entityId and name");
      const entityId = cleanText(item.entityId, 100);
      const name = cleanText(item.name, 100);
      if (!entityId || !name) return bad("Each artist needs entityId and name");
      if (!confirmed.some((artist) => artist.entityId === entityId)) {
        confirmed.push({ entityId, name });
      }
    }
  }

  if (artistNames.length + confirmed.length > MAX_ARTISTS) {
    return bad(`Use at most ${MAX_ARTISTS} artists`);
  }

  const curated = body.genreTagId === undefined ? null : findGenreByTagId(body.genreTagId);
  if (body.genreTagId !== undefined && !curated) return bad("genreTagId is not one of our genres");
  const genre = curated ? curated.label : body.genre === undefined ? null : cleanText(body.genre, 60);
  const city = body.city === undefined ? null : cleanText(body.city, 100);

  let audience: AudienceAge | null = null;
  if (body.age !== undefined && body.age !== null && body.age !== "") {
    audience = findAudienceAge(body.age);
    if (!audience) {
      return bad(`age must be one of: ${AUDIENCE_AGES.map((option) => option.id).join(", ")}`);
    }
  }

  if (body.includeAlcohol !== undefined && typeof body.includeAlcohol !== "boolean") {
    return bad("includeAlcohol must be true or false");
  }
  let admission: Admission = DEFAULT_ADMISSION;
  if (body.admission !== undefined && body.admission !== null && body.admission !== "") {
    const match = findAdmission(body.admission);
    if (!match) {
      return bad(`admission must be one of: ${ADMISSIONS.map((option) => option.id).join(", ")}`);
    }
    admission = match;
  }

  // Alcohol brands only for 21+ events, whatever the request asks for.
  const alcoholBlocked = !admission.alcoholAllowed;
  const includeAlcohol = !alcoholBlocked && body.includeAlcohol === true;

  if (artistNames.length === 0 && confirmed.length === 0 && !genre) {
    return bad("Give at least one artist or a genre");
  }

  // The saved "Try an example" search is answered from the recording and is
  // not limited. Everything else is a live search and counts. Exact match on
  // purpose: Qloo is asked with these exact strings, in this order, so any
  // change (even letter case) needs a live call.
  const exampleAt = savedExampleAt("brands", {
    artistNames,
    artists: confirmed.map((artist) => artist.entityId),
    genreTagId: curated?.tagId ?? null,
    genre: curated ? null : genre,
    city,
    age: audience?.id ?? null,
    admission: admission.id,
    includeAlcohol,
  });
  if (!exampleAt) {
    const blocked = blockLiveSearch(request, "search");
    if (blocked) return blocked;
  }

  // ----- talk to Qloo -----
  // Each step is reported when its Qloo calls start, so the UI shows what is
  // really running (no timer).
  const search = async (step: (name: SearchStep) => void): Promise<{ status: number; body: unknown }> => {
    try {
      const lookups: QlooCall[] = [];
      if (artistNames.length > 0) step("artists");
      if (!curated && genre) step("genre");
      const [searches, genreTags] = await Promise.all([
        Promise.all(artistNames.map((name) => searchArtists(name, 3, lookups))),
        curated
          ? Promise.resolve<GenreTag[]>([{ id: curated.tagId, name: curated.label }])
          : genre
            ? searchGenreTags(genre, 5, lookups)
            : Promise.resolve<GenreTag[]>([]),
      ]);

      // A typed name only counts when Qloo returns the same name. Anything else
      // (no result, or a different name such as "Wishy" -> "Wish You Were Here")
      // goes back to the UI so the user can pick or switch to a genre.
      const artists: ConfirmedArtist[] = [...confirmed];
      const unresolved: { query: string; candidates: ArtistMatch[] }[] = [];
      searches.forEach((matches, index) => {
        const exact = matches.find((match) => match.exactName);
        if (!exact) {
          unresolved.push({ query: artistNames[index], candidates: matches });
        } else if (!artists.some((artist) => artist.entityId === exact.entityId)) {
          artists.push({ entityId: exact.entityId, name: exact.name });
        }
      });

      // Only the closest genre tag: extra tags widen the audience.
      const usedTags = genreTags.slice(0, 1);

      if (artists.length === 0 && usedTags.length === 0) {
        return {
          status: 404,
          body: { error: "None of these artists or genres were found in Qloo", unresolved, genre },
        };
      }

      const { categories, calls: brandCalls, cityDropped, dropped } = await getSponsorBrands({
        artists,
        genreTags: usedTags,
        city: city ?? undefined,
        age: audience?.id,
        includeAlcohol,
        onStep: step,
      });
      const calls = [...lookups, ...brandCalls];

      return {
        status: 200,
        body: {
          input: {
            city,
            cityDropped,
            genre,
            age: audience?.id ?? null,
            admission: admission.id,
            includeAlcohol,
            alcoholBlocked,
          },
          artists,
          genreTags: usedTags,
          genreMatch: genre && !curated ? { query: genre, tag: usedTags[0] ?? null } : null,
          unresolved,
          categories,
          dropped,
          calls,
          savedExample: exampleAt && calls.every((call) => call.saved) ? exampleAt : null,
          tookMs: Date.now() - started,
        },
      };
    } catch (error) {
      // Upstream error text stays in the server log; the browser gets a short message.
      const failure = publicQlooFailure(error, "/api/brands");
      return { status: failure.status, body: { error: failure.error } };
    }
  };

  // The page asks for a stream: one JSON line per step, then the result.
  if (request.headers.get("accept")?.includes("application/x-ndjson")) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (line: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
        const result = await search((name) => send({ step: name }));
        send({ done: true, status: result.status, body: result.body });
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const result = await search(() => {});
  return NextResponse.json(result.body, { status: result.status });
}
