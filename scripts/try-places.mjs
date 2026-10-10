// Probe for the "local sponsors on a map" feature: which Qloo place fields we
// actually get (coordinates, address, category, rating, website) before any
// UI is built. Raw fetch on purpose, so nothing in src/ changes yet.
//
// Run from the project root:
//   node --env-file=.env.local scripts/try-places.mjs
// Optional: your own line-up, venue/area last
//   node --env-file=.env.local scripts/try-places.mjs "Phoebe Bridgers" "Clairo" "Zilker Park, Austin, TX"
//
// Writes the full first result to scripts/places-sample.json so its exact
// field names can be checked.

import { writeFileSync } from "node:fs";

const BASE = "https://hackathon.api.qloo.com";
const KEY = process.env.QLOO_API_KEY;
if (!KEY) {
  console.error("QLOO_API_KEY is not set. Run with --env-file=.env.local");
  process.exit(1);
}

const args = process.argv.slice(2);
const area = args.length > 1 ? args[args.length - 1] : "Austin, TX";
const names = args.length > 1 ? args.slice(0, -1) : ["Phoebe Bridgers", "boygenius", "Clairo"];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(path, params) {
  const url = new URL(path, BASE);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const started = Date.now();
    const response = await fetch(url, { headers: { "X-Api-Key": KEY } });
    const text = await response.text();
    if (response.status === 429) {
      await sleep(800 * 2 ** attempt);
      continue;
    }
    if (!response.ok) {
      console.log(`  !! ${response.status}: ${text.slice(0, 200)}`);
      return { entities: [], ms: Date.now() - started };
    }
    const data = JSON.parse(text);
    const results = data.results ?? {};
    const entities = Array.isArray(results) ? results : results.entities ?? [];
    return { entities, ms: Date.now() - started };
  }
  console.log("  !! still rate limited after 4 tries");
  return { entities: [], ms: 0 };
}

function coords(entity) {
  const location = entity.location ?? {};
  const geocode = entity.properties?.geocode ?? {};
  const lat = location.lat ?? location.latitude ?? geocode.latitude ?? geocode.lat;
  const lon = location.lon ?? location.lng ?? location.longitude ?? geocode.longitude ?? geocode.lng;
  return typeof lat === "number" && typeof lon === "number" ? `${lat.toFixed(4)},${lon.toFixed(4)}` : "NO COORDS";
}

function show(title, entities, ms) {
  console.log(`\n--- ${title}: ${entities.length} results in ${ms} ms`);
  for (const entity of entities.slice(0, 8)) {
    const props = entity.properties ?? {};
    const affinity = entity.query?.affinity;
    console.log(
      `  - ${entity.name} | ${coords(entity)} | ${props.address ?? "no address"}` +
        ` | rating ${props.business_rating ?? "-"} | price ${props.price_level ?? "-"}` +
        ` | ${props.website ? "website" : "no website"} | affinity ${typeof affinity === "number" ? affinity.toFixed(2) : "-"}`,
    );
  }
}

// 1. Artist IDs
const ids = [];
for (const name of names) {
  const { entities } = await get("/search", { query: name, types: "urn:entity:artist", take: 1 });
  if (entities[0]) {
    ids.push(entities[0].entity_id);
    console.log(`ok  ${name} -> ${entities[0].name}`);
  } else {
    console.log(`??  ${name} not found`);
  }
}
if (ids.length === 0) process.exit(1);
const signal = ids.join(",");

// 2. Places by category, around the area
const CATEGORIES = [
  ["Cafes", "urn:tag:genre:place:restaurant:cafe"],
  ["Bars", "urn:tag:genre:place:restaurant:bar"],
  ["Restaurants", "urn:tag:genre:place:restaurant"],
  ["Clothing stores", "urn:tag:category:place:clothing_store"],
];

let sampleSaved = false;
for (const [label, tag] of CATEGORIES) {
  const { entities, ms } = await get("/v2/insights", {
    "filter.type": "urn:entity:place",
    "signal.interests.entities": signal,
    "filter.location.query": area,
    "filter.location.radius": 5000,
    "filter.tags": tag,
    "feature.explainability": "true",
    take: 10,
  });
  show(`${label} within 5 km of "${area}"`, entities, ms);
  if (!sampleSaved && entities[0]) {
    writeFileSync("scripts/places-sample.json", JSON.stringify(entities[0], null, 2));
    sampleSaved = true;
    console.log("  (full first result saved to scripts/places-sample.json)");
  }
}

// 3. Does the radius change anything?
const wide = await get("/v2/insights", {
  "filter.type": "urn:entity:place",
  "signal.interests.entities": signal,
  "filter.location.query": area,
  "filter.tags": CATEGORIES[0][1],
  take: 10,
});
show(`Cafes, no radius ("${area}")`, wide.entities, wide.ms);

console.log("\nDone. Send the whole output (and places-sample.json) to the chat.");