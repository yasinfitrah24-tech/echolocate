// Quick manual check of src/lib/qloo.ts against the real Qloo API.
//
// Run from the project root:
//   node --env-file=.env.local scripts/try-qloo.mjs
// Optional: your own line-up, city last
//   node --env-file=.env.local scripts/try-qloo.mjs "Phoebe Bridgers" "Clairo" "Austin, TX"

import { getSponsorBrands, searchArtists, searchGenreTags } from "../src/lib/qloo.ts";

const args = process.argv.slice(2);
const city = args.length > 1 ? args[args.length - 1] : "Austin, TX";
const names = args.length > 1 ? args.slice(0, -1) : ["Phoebe Bridgers", "boygenius", "Clairo"];

console.log(`\n== 1. Artist search (${names.join(", ")}) ==`);
const found = await Promise.all(names.map((name) => searchArtists(name, 3)));
const artists = [];
found.forEach((matches, index) => {
  const top = matches[0];
  if (!top) {
    console.log(`  ${names[index]}: NOT FOUND`);
    return;
  }
  const flag = top.exactName ? "ok" : "SKIPPED: name differs, needs confirmation in the UI";
  console.log(`  ${names[index]} -> ${top.name} (popularity ${top.popularity}, image ${top.imageUrl ? "yes" : "no"}) [${flag}]`);
  if (matches.length > 1) {
    console.log(`     other candidates: ${matches.slice(1).map((match) => match.name).join(", ")}`);
  }
  if (top.exactName) artists.push({ entityId: top.entityId, name: top.name });
});

console.log(`\n== 2. Genre tags for "indie pop" ==`);
const tags = await searchGenreTags("indie pop");
console.log(tags.length ? tags.map((tag) => `  ${tag.id} (${tag.name})`).join("\n") : "  none found");

if (artists.length === 0) {
  console.log("\nNo artists found, stopping.");
  process.exit(1);
}

console.log(`\n== 3. Sponsor brands (${city}, 24 and younger) ==`);
const started = Date.now();
// includeAlcohol is on here only to exercise all five Qloo calls; the app keeps it off for a young crowd.
const { categories, calls } = await getSponsorBrands({ artists, city, age: "24_and_younger", includeAlcohol: true });
console.log(`  total time: ${Date.now() - started} ms for ${calls.length} parallel calls`);

for (const category of categories) {
  console.log(`\n  ${category.label} (${category.brands.length})`);
  for (const brand of category.brands.slice(0, 5)) {
    console.log(`    ${String(brand.fitScore).padStart(3)}  ${brand.name}  [#${brand.rank}/${brand.listSize} ${brand.source}, affinity ${brand.affinity}]`);
    if (brand.reasonText) console.log(`         ${brand.reasonText}`);
  }
}

console.log("\n== 4. Call log ==");
for (const call of calls) {
  console.log(`  ${call.label}: ${call.resultCount} results in ${call.ms} ms, retries ${call.retries}${call.error ? ` ERROR ${call.error}` : ""}`);
}

const all = categories.flatMap((category) => category.brands);

console.log("\n== 5. Raw reasons (Qloo explainability scores) ==");
const spread = (brand) => (brand.reasons.length > 1 ? brand.reasons[0].share - brand.reasons[brand.reasons.length - 1].share : 0);
const samples = [...all].sort((a, b) => spread(b) - spread(a)).slice(0, 4).concat(all.slice(0, 2));
for (const brand of samples) {
  const parts = brand.reasons.map((reason) => `${reason.name} score ${reason.score.toFixed(4)} share ${(reason.share * 100).toFixed(1)}%`);
  console.log(`  ${brand.name}: ${parts.join(" | ")}`);
}
const spreads = all.map(spread).sort((a, b) => a - b);
console.log(`  share spread (top minus bottom artist): min ${(spreads[0] * 100).toFixed(1)}, median ${(spreads[Math.floor(spreads.length / 2)] * 100).toFixed(1)}, max ${(spreads[spreads.length - 1] * 100).toFixed(1)} points`);

console.log("\n== 6. Checks ==");
const withReasons = all.filter((brand) => brand.reasons.length > 0).length;
console.log(`  brands with reasons: ${withReasons}/${all.length}${withReasons === 0 ? "  <-- explainability not parsed, send this output to Claude" : ""}`);
const empty = calls.filter((call) => call.resultCount === 0);
console.log(`  empty calls: ${empty.length ? empty.map((call) => call.label).join(", ") : "none"}`);
const scores = all.map((brand) => brand.fitScore);
console.log(`  fit score range: ${Math.min(...scores)}-${Math.max(...scores)}`);
