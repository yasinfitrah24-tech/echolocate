// The "Try an example" searches, answered from saved real Qloo responses
// (src/data/demo/qloo-recording.json), so they are instant and cost no Qloo
// calls during judging. Server only; import it from the API routes.
//
// Only the raw Qloo answers are saved. Scores, reasons and the alcohol rule
// still run on them, so changes to that code apply without recording again.
// The file is in a public repo, so each answer keeps only the fields
// src/lib/qloo.ts reads. Answers are keyed by their Qloo request, so several
// examples share one file.
//
// To record one example again (8-11 Qloo calls; dev only), see
// scripts/record-demo.mjs.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import recording from "@/data/demo/qloo-recording.json";
import { setQlooCache } from "@/lib/qloo";

interface SavedExample {
  /** "campus", "bar": the same ids as EXAMPLES in sponsor-finder.tsx and scripts/record-demo.mjs. */
  id: string;
  savedAt: string;
  /** Normalized route input the example covers, per route. */
  requests: Record<string, string>;
}

interface Recording {
  examples: SavedExample[];
  responses: Record<string, unknown>;
}

const RECORDING_FILE = join(process.cwd(), "src", "data", "demo", "qloo-recording.json");

/** Record mode: every live Qloo answer is written to the file instead of replayed. */
export const RECORDING = process.env.QLOO_RECORD === "1" && process.env.NODE_ENV !== "production";

/** In record mode, the example the route inputs are saved under. */
const RECORD_ID = process.env.QLOO_RECORD_EXAMPLE?.trim() || "campus";

const saved = recording as unknown as Recording;

// ---------- keep only what qloo.ts reads ----------

type Json = Record<string, unknown>;

function obj(value: unknown): Json {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Json) : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Copies only the listed keys that are present. */
function pick(source: Json, keys: string[]): Json {
  const out: Json = {};
  for (const key of keys) if (source[key] !== undefined) out[key] = source[key];
  return out;
}

function trimEntity(raw: unknown): Json {
  const entity = obj(raw);
  const props = obj(entity.properties);
  const query = obj(entity.query);
  const explain = obj(query.explainability);
  const location = obj(entity.location);
  const firstImage = obj(list(props.images)[0]);
  return {
    ...pick(entity, ["entity_id", "name", "popularity", "disambiguation"]),
    // Only brand tags are read (category and the alcohol / NGO rules).
    tags: list(entity.tags)
      .map((tag) => obj(tag).id)
      .filter((id): id is string => typeof id === "string" && id.startsWith("urn:tag:genre:brand:"))
      .map((id) => ({ id })),
    ...(location.lat !== undefined ? { location: pick(location, ["lat", "lon"]) } : {}),
    query: {
      ...pick(query, ["affinity"]),
      explainability: {
        "signal.interests.entities": list(explain["signal.interests.entities"]).map((row) =>
          pick(obj(row), ["entity_id", "score"]),
        ),
        "signal.interests.tags": list(explain["signal.interests.tags"]).map((row) =>
          pick(obj(row), ["tag_id", "id", "score"]),
        ),
      },
    },
    properties: {
      ...pick(props, [
        "short_description",
        "description",
        "address",
        "website",
        "phone",
        "business_rating",
        "price_level",
        "is_closed",
      ]),
      ...(obj(props.image).url ? { image: { url: obj(props.image).url } } : {}),
      ...(obj(props.geocode).name ? { geocode: { name: obj(props.geocode).name } } : {}),
      ...(firstImage.url ? { images: [{ url: firstImage.url }] } : {}),
    },
  };
}

function trimResponse(path: string, data: unknown): unknown {
  const results = obj(data).results;
  if (path === "/search") return { results: list(results).map(trimEntity) };
  if (path === "/v2/tags") {
    return { results: { tags: list(obj(results).tags).map((tag) => pick(obj(tag), ["id", "name"])) } };
  }
  return { results: { entities: list(obj(results).entities).map(trimEntity) } };
}

// ---------- reading and writing the file (record mode only writes) ----------

function readFile(): Recording {
  try {
    return JSON.parse(readFileSync(RECORDING_FILE, "utf8")) as Recording;
  } catch {
    return { examples: [], responses: {} };
  }
}

/**
 * Read-merge-write on every answer: writing the file makes the dev server
 * reload this module, so nothing recorded is kept only in memory.
 */
function update(change: (current: Recording) => void): void {
  const current = readFile();
  change(current);
  writeFileSync(RECORDING_FILE, `${JSON.stringify(current, null, 1)}\n`);
}

/** Same JSON for the same input, whatever the key order. */
function stable(input: Record<string, unknown>): string {
  return JSON.stringify(Object.keys(input).sort().map((key) => [key, input[key]]));
}

setQlooCache(
  RECORDING
    ? {
        get: () => undefined,
        put: (path, key, data) => update((current) => (current.responses[key] = trimResponse(path, data))),
      }
    : { get: (key) => saved.responses[key] },
);

/**
 * When this route input is one of the saved examples: the time it was
 * recorded. Such a search makes no live Qloo calls and does not count against
 * the demo limits. Null for any other input. In record mode it notes the input
 * under RECORD_ID instead and returns null.
 */
export function savedExampleAt(route: "brands" | "places", input: Record<string, unknown>): string | null {
  if (RECORDING) {
    update((current) => {
      let example = current.examples.find((item) => item.id === RECORD_ID);
      if (!example) {
        example = { id: RECORD_ID, savedAt: "", requests: {} };
        current.examples.push(example);
      }
      example.requests[route] = stable(input);
      example.savedAt = new Date().toISOString();
    });
    return null;
  }
  const key = stable(input);
  return saved.examples.find((example) => example.requests[route] === key)?.savedAt ?? null;
}
