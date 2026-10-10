// Calls the running app's /api/brands and prints a summary.
//
// 1. In one terminal:   npm run dev
// 2. In another:        node scripts/try-api.mjs
//    Own line-up, city last:
//                       node scripts/try-api.mjs "Sabrina Carpenter" "Luke Combs" "The Killers" "Austin, TX"

const base = process.env.APP_URL ?? "http://localhost:3000";
const args = process.argv.slice(2);
const city = args.length > 1 ? args[args.length - 1] : "Austin, TX";
const artistNames = args.length > 1 ? args.slice(0, -1) : ["Phoebe Bridgers", "boygenius", "Clairo"];

console.log(`POST ${base}/api/brands  (${artistNames.join(", ")} | ${city} | 24 and younger, all ages)`);

let response;
try {
  response = await fetch(`${base}/api/brands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ artistNames, city, age: "24_and_younger", admission: "all_ages" }),
  });
} catch (error) {
  console.log(`Could not reach ${base}. Is "npm run dev" running in another terminal?`);
  console.log(String(error.cause ?? error));
  process.exit(1);
}

const data = await response.json();
console.log(`status ${response.status}`);
if (!response.ok) {
  console.log(JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log(`\nartists used: ${data.artists.map((artist) => artist.name).join(", ") || "none"}`);
for (const item of data.unresolved) {
  console.log(`needs confirmation: "${item.query}" -> ${item.candidates.map((c) => c.name).join(", ") || "not found"}`);
}

for (const category of data.categories) {
  console.log(`\n  ${category.label} (${category.brands.length})`);
  for (const brand of category.brands.slice(0, 3)) {
    console.log(`    ${String(brand.fitScore).padStart(3)}  ${brand.name}`);
    console.log(`         ${brand.reasonText}`);
  }
}

console.log("\ncalls:");
for (const call of data.calls) {
  console.log(`  ${call.label}: ${call.resultCount} results, ${call.ms} ms, retries ${call.retries}${call.error ? ` ERROR ${call.error}` : ""}`);
}

const all = data.categories.flatMap((category) => category.brands);
const leaning = all.filter((brand) => brand.reasonText.includes("Leans toward")).length;
console.log(`\ntotal: ${all.length} brands in ${data.categories.length} categories, ${data.tookMs} ms`);
console.log(`reasons: ${leaning} lean toward one artist, ${all.length - leaning} even across the line-up`);
