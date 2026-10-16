// Does a coordinate signal work for brands where a city name does not?
// 4 Qloo calls, one at a time.
//
// Run from the project root:
//   node --env-file=.env.local scripts/probe-point.mjs
//
// Calls:
//   1. artist id for Phoebe Bridgers (the line-up signal; one artist keeps
//      this at 4 calls)
//   2. brands, Indio CA:  signal.location=POINT(lon lat), radius 50000
//   3. brands, Austin TX: signal.location=POINT(lon lat), radius 15000
//   4. brands, Austin TX: signal.location.query="Austin, TX" (today)
// Coordinates come from public/data/us-cities.json.
//
// Indio with a city name gave 0 brands (probe-form.mjs, 16 Oct).

import { readFileSync } from "node:fs";

const BASE = "https://hackathon.api.qloo.com";
const KEY = process.env.QLOO_API_KEY;
if (!KEY) {
  console.error("QLOO_API_KEY is not set. Run with --env-file=.env.local");
  process.exit(1);
}

const MAX_CALLS = 4;
let used = 0;

async function get(path, params) {
  if (used >= MAX_CALLS) throw new Error(`Stopped: ${MAX_CALLS} calls used`);
  used += 1;
  const url = new URL(path, BASE);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const response = await fetch(url, { headers: { "X-Api-Key": KEY, Accept: "application/json" } });
  if (!response.ok) {
    console.log(`  ${path} returned ${response.status}`);
    return null;
  }
  return response.json();
}

const cities = JSON.parse(readFileSync("public/data/us-cities.json", "utf8"));
function coords(name, state) {
  const row = cities.find(([n, s]) => n === name && s === state);
  if (!row) throw new Error(`${name}, ${state} is not in us-cities.json`);
  return { lat: row[3], lon: row[4] };
}

const search = await get("/search", { query: "Phoebe Bridgers", types: "urn:entity:artist", take: 3 });
const artist = (search?.results ?? []).find((item) => item.name === "Phoebe Bridgers");
if (!artist) {
  console.log("Phoebe Bridgers not found, stopping after 1 call.");
  process.exit(1);
}

async function brands(label, location) {
  const data = await get("/v2/insights", {
    "filter.type": "urn:entity:brand",
    "signal.interests.entities": artist.entity_id,
    take: 10,
    ...location,
  });
  const names = (data?.results?.entities ?? []).map((entity) => entity.name);
  console.log(`\n${label}: ${data ? `${names.length} brands` : "failed"}`);
  console.log(`  top 5: ${names.slice(0, 5).join(", ") || "-"}`);
  return names;
}

const indio = coords("Indio", "CA");
const austin = coords("Austin", "TX");
const point = ({ lat, lon }) => `POINT(${lon} ${lat})`;

await brands("Indio, CA  POINT + radius 50000", {
  "signal.location": point(indio),
  "signal.location.radius": 50000,
});
const byPoint = await brands("Austin, TX POINT + radius 15000", {
  "signal.location": point(austin),
  "signal.location.radius": 15000,
});
const byName = await brands('Austin, TX city name (today)', { "signal.location.query": "Austin, TX" });

const overlap = byPoint.slice(0, 5).filter((name) => byName.slice(0, 5).includes(name)).length;
console.log(`\nAustin top-5 overlap, POINT vs city name: ${overlap}/5`);
console.log(`Calls used: ${used} of ${MAX_CALLS}`);
