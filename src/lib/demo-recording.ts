// The "Try an example" search, answered from saved real Qloo responses
// (src/data/demo/qloo-recording.json), so it is instant and costs no Qloo
// calls during judging. Server only; import it from the API routes.
//
// Only the raw Qloo answers are saved. Scores, reasons and the alcohol rule
// still run on them, so changes to that code apply without recording again.
// The file is in a public repo, so each answer keeps only the fields
// src/lib/qloo.ts reads.
//
// To record again (8 Qloo calls; dev only):
//   PowerShell:  $env:QLOO_RECORD="1"; npm run dev
//   then:        node scripts/record-demo.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import recording from "@/data/demo/qloo-recording.json";
import { setQlooCache } from "@/lib/qloo";

interface Recording {
  savedAt: string | null;
  /** Normalized route input that the recording covers, per route. */
  requests: Record<string, string>;
  responses: Record<string, unknown>;
}

const RECORDING_FILE = join(process.cwd(), "src", "data", "demo", "qloo-recording.json");

/** Record mode: every live Qloo answer is written to the file instead of replayed. */
export const RECORDING = process.env.QLOO_RECORD === "1" && process.env.NODE_ENV !== "production";

const saved = recording as Recording;

/** When the saved example was recorded, or null when nothing is saved. */
export const savedAt: string | null = RECORDING ? null : saved.savedAt;

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
    return { savedAt: null, requests: {}, responses: {} };
  }
}

/**
 * Read-merge-write on every answer: writing the file makes the dev server
 * reload this module, so nothing recorded is kept only in memory.
 */
function update(change: (current: Recording) => void): void {
  const current = readFile();
  change(current);
  current.savedAt = new Date().toISOString();
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
 * True when this route input is the saved example, so it makes no live Qloo
 * calls and does not count against the demo limits. In record mode it notes
 * the input as the example instead.
 */
export function isSavedExample(route: "brands" | "places", input: Record<string, unknown>): boolean {
  if (RECORDING) {
    update((current) => (current.requests[route] = stable(input)));
    return false;
  }
  return saved.requests[route] === stable(input);
}
