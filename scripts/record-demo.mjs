// Records the "Try an example" search from real Qloo answers into
// src/data/demo/qloo-recording.json. About 8 Qloo calls (10 if the map
// search widens its radius).
//
// 1. Start the dev server in record mode (PowerShell):
//      $env:QLOO_RECORD="1"; npm run dev
// 2. In a second terminal, from the project root:
//      node scripts/record-demo.mjs
// 3. Stop the dev server, start it again normally, and check that
//    "Try an example" shows "Saved example".
//
// The request bodies below must match what the form sends for the example
// (src/components/sponsor-finder.tsx, EXAMPLE), or the recording is never used.

import { readFileSync, statSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const FILE = "src/data/demo/qloo-recording.json";

const EXAMPLE = {
  artistNames: ["Phoebe Bridgers", "boygenius", "Clairo"],
  artists: [],
  city: "Austin, TX",
  age: "24_and_younger",
  admission: "all_ages",
  includeAlcohol: false,
};

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

// Start from an empty file, so old answers do not linger.
writeFileSync(FILE, `${JSON.stringify({ savedAt: null, requests: {}, responses: {} }, null, 1)}\n`);

const brands = await post("/api/brands", EXAMPLE);
const brandCount = brands.categories.reduce((sum, category) => sum + category.brands.length, 0);
console.log(`brands: ${brandCount} in ${brands.categories.length} categories, ${brands.calls.length} insight calls`);
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
console.log(`places: ${places.places.length} (${places.search.by}, ${places.search.radiusKm} km${places.search.widened ? ", widened" : ""})`);

const saved = JSON.parse(readFileSync(FILE, "utf8"));
const answers = Object.keys(saved.responses).length;
if (answers === 0) {
  console.error("\nNothing was saved. Is the dev server running with QLOO_RECORD=1?");
  process.exit(1);
}
console.log(`\nSaved ${answers} Qloo answers for ${Object.keys(saved.requests).join(" + ")}`);
console.log(`${FILE}: ${(statSync(FILE).size / 1024).toFixed(1)} KB`);
