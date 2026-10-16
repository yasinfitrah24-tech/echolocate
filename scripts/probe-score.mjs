// Live search used to check the Sponsor Fit Score formula on a second
// line-up: country (Zach Bryan, Kacey Musgraves) in Nashville, all ages.
// Goes through the app's own routes, so it is exactly what the UI gets.
// About 7 Qloo calls (2 artist searches, 3 brand lists, 2 place lists;
// 9 if the map search widens). Counts as one live search for the limits.
//
// 1. Start the dev server normally: npm run dev
// 2. From the project root: node scripts/probe-score.mjs
//
// Writes scripts/probe-score-results.json (not committed): rank, list size,
// source and affinity for every brand and place.

import { writeFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";

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

const brands = await post("/api/brands", {
  artistNames: ["Zach Bryan", "Kacey Musgraves"],
  artists: [],
  city: "Nashville, TN",
  admission: "all_ages",
  includeAlcohol: false,
});
if (brands.savedExample) console.log("Warning: this came from the saved example, not live.");
if (brands.unresolved.length > 0) {
  console.log(`Not resolved: ${brands.unresolved.map((item) => item.query).join(", ")}`);
}

const places = await post("/api/places", {
  artists: brands.artists,
  genreTags: brands.genreTags,
  city: brands.input.city,
  admission: brands.input.admission,
});

const rows = [
  ...brands.categories.flatMap((category) =>
    category.brands.map((brand) => ({
      kind: "brand",
      cat: category.label,
      name: brand.name,
      source: brand.source,
      rank: brand.rank,
      size: brand.listSize,
      aff: brand.affinity,
      old: brand.fitScore,
    })),
  ),
  ...places.places.map((place) => ({
    kind: "place",
    cat: place.categoryLabel,
    name: place.name,
    source: "place",
    rank: place.rank,
    size: place.listSize,
    aff: place.affinity,
    old: place.fitScore,
  })),
];
writeFileSync("scripts/probe-score-results.json", `${JSON.stringify(rows, null, 1)}\n`);

const brandCount = rows.filter((row) => row.kind === "brand").length;
console.log(`${brandCount} brands in ${brands.categories.length} categories, ${places.places.length} places`);
console.log(`Qloo calls: ${brands.calls.length} brand lists + ${places.calls.length} place lists (+ artist searches)`);
console.log("Wrote scripts/probe-score-results.json");
