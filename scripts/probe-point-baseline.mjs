// Is signal.location=POINT really used for brands, or silently ignored?
// Qloo ignores parameters it does not use, so "Indio by POINT gave 10 brands"
// could just be the list with no location at all. 2 Qloo calls.
//
// Run from the project root:
//   node --env-file=.env.local scripts/probe-point-baseline.mjs
//
// Compare its output with scripts/probe-point.mjs (16 Oct):
//   Indio POINT  top 5: Dr. Martens, Fender, Urban Outfitters, Vans, Rolling Stone
//   Austin POINT top 5: Fender, Dr. Martens, Urban Outfitters, Gibson, Vans
// If the no-location list matches either one, POINT is being ignored.

const BASE = "https://hackathon.api.qloo.com";
const KEY = process.env.QLOO_API_KEY;
if (!KEY) {
  console.error("QLOO_API_KEY is not set. Run with --env-file=.env.local");
  process.exit(1);
}

async function get(path, params) {
  const url = new URL(path, BASE);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const response = await fetch(url, { headers: { "X-Api-Key": KEY, Accept: "application/json" } });
  if (!response.ok) {
    console.log(`${path} returned ${response.status}`);
    process.exit(1);
  }
  return response.json();
}

const INDIO_POINT = ["Dr. Martens", "Fender", "Urban Outfitters", "Vans", "Rolling Stone"];
const AUSTIN_POINT = ["Fender", "Dr. Martens", "Urban Outfitters", "Gibson", "Vans"];

const search = await get("/search", { query: "Phoebe Bridgers", types: "urn:entity:artist", take: 3 });
const artist = (search?.results ?? []).find((item) => item.name === "Phoebe Bridgers");
if (!artist) {
  console.log("Phoebe Bridgers not found, stopping after 1 call.");
  process.exit(1);
}

const data = await get("/v2/insights", {
  "filter.type": "urn:entity:brand",
  "signal.interests.entities": artist.entity_id,
  take: 10,
});
const names = (data?.results?.entities ?? []).map((entity) => entity.name);
const top5 = names.slice(0, 5);
const same = (list) => list.every((name, index) => top5[index] === name);
console.log(`No location: ${names.length} brands`);
console.log(`  top 5: ${top5.join(", ")}`);
console.log(`  same order as Indio POINT: ${same(INDIO_POINT)}  · as Austin POINT: ${same(AUSTIN_POINT)}`);
console.log(`  overlap with Indio POINT: ${INDIO_POINT.filter((name) => top5.includes(name)).length}/5`);
console.log("Calls used: 2");
