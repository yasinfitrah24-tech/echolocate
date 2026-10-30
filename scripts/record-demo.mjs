// Records one "Try an example" search from real Qloo answers into
// src/data/demo/qloo-recording.json. About 8 Qloo calls (11 for the 21+
// example, more if the map search widens its radius). Other examples in the
// file are kept.
//
// 1. Start the dev server in record mode, naming the example (PowerShell):
//      $env:QLOO_RECORD="1"; $env:QLOO_RECORD_EXAMPLE="bar"; npm run dev
// 2. In a second terminal, from the project root:
//      node scripts/record-demo.mjs bar
// 3. Stop the dev server. Then close that terminal, or run
//      Remove-Item Env:QLOO_RECORD; Remove-Item Env:QLOO_RECORD_EXAMPLE
//    and start it again normally. Check that the example shows "Saved example".
//
// The request bodies below must match what the form sends for each example
// (src/components/sponsor-finder.tsx, EXAMPLES), or the recording is never used.

import { readFileSync, statSync } from "node:fs";

const EXAMPLES = {
  // Campus show, 800 people, all ages, artists on the line-up.
  campus: {
    artistNames: ["Phoebe Bridgers", "boygenius", "Clairo"],
    artists: [],
    city: "Austin, TX",
    age: "24_and_younger",
    admission: "all_ages",
    includeAlcohol: false,
  },
  // Bar gig, 150 people, 21+, local bands: genre only, a smaller city.
  bar: {
    artistNames: [],
    artists: [],
    genreTagId: "urn:tag:genre:music:indie_rock",
    city: "Athens, GA",
    age: "24_and_younger",
    admission: "21_plus",
    includeAlcohol: true,
  },
};

const id = process.argv[2] ?? "campus";
const BASE = process.argv[3] ?? "http://localhost:3000";
const FILE = "src/data/demo/qloo-recording.json";
const example = EXAMPLES[id];
if (!example) {
  console.error(`Unknown example "${id}". Use one of: ${Object.keys(EXAMPLES).join(", ")}`);
  process.exit(1);
}

async function post(path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    console.error(`${path} returned ${response.status}: ${data.error ?? "no message"}`);
    process.exit(1);
  }
  return data;
}

const brands = await post("/api/brands", example);
const brandCount = brands.categories.reduce((sum, category) => sum + category.brands.length, 0);
console.log(`brands: ${brandCount} in ${brands.categories.length} categories, ${brands.calls.length} Qloo calls`);
if (brands.input.cityDropped) console.log("  Qloo had no data for the city: brands are for the line-up alone");
if (brands.unresolved.length > 0) {
  console.log(`  not resolved: ${brands.unresolved.map((item) => item.query).join(", ")} (the example will not be fully saved)`);
}

const places = await post("/api/places", {
  artists: brands.artists,
  genreTags: brands.genreTags,
  city: brands.input.city,
  age: brands.input.age ?? undefined,
  admission: brands.input.admission,
});
console.log(`places: ${places.places.length} (${places.search.by}, ${places.search.radiusKm} km${places.search.widened ? ", widened" : ""}), ${places.calls.length} Qloo calls`);

const saved = JSON.parse(readFileSync(FILE, "utf8"));
const entry = (saved.examples ?? []).find((item) => item.id === id);
if (!entry || !entry.requests.brands || !entry.requests.places) {
  console.error(`\nThe "${id}" example was not saved. Is the dev server running with QLOO_RECORD=1 and QLOO_RECORD_EXAMPLE=${id}?`);
  process.exit(1);
}
console.log(`\nSaved "${id}" (${entry.savedAt}). The file holds ${Object.keys(saved.responses).length} Qloo answers.`);
console.log(`${FILE}: ${(statSync(FILE).size / 1024).toFixed(1)} KB`);
