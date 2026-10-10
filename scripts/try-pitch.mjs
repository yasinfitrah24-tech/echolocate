// End-to-end check: line-up -> brands -> pitch draft for the top brand.
//
// 1. In one terminal:   npm run dev
// 2. In another:        node scripts/try-pitch.mjs
//    A specific brand:  node scripts/try-pitch.mjs "Lone Star"

const base = process.env.APP_URL ?? "http://localhost:3000";
const wanted = process.argv[2]?.toLowerCase();
const artistNames = ["Phoebe Bridgers", "boygenius", "Clairo"];
const event = { name: "Spring Quad Fest", city: "Austin, TX", crowdSize: 800, age: "24_and_younger", admission: "all_ages" };

async function post(path, body) {
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.log(`Could not reach ${base}. Is "npm run dev" running in another terminal?`);
    console.log(String(error.cause ?? error));
    process.exit(1);
  }
  const data = await response.json();
  if (!response.ok) {
    console.log(`${path} -> status ${response.status}`);
    console.log(JSON.stringify(data, null, 2));
    process.exit(1);
  }
  return data;
}

console.log(`1. /api/brands (${artistNames.join(", ")} | ${event.city})`);
const brands = await post("/api/brands", { artistNames, city: event.city, age: event.age, admission: event.admission });
console.log(`   ${brands.categories.length} categories in ${brands.tookMs} ms`);

let pick = null;
for (const category of brands.categories) {
  for (const brand of category.brands) {
    if (!pick && (!wanted || brand.name.toLowerCase().includes(wanted))) {
      pick = { name: brand.name, categoryLabel: category.label, reasonText: brand.reasonText, fitScore: brand.fitScore };
    }
  }
}
if (!pick) {
  console.log(`   no brand matching "${wanted}"`);
  process.exit(1);
}
console.log(`   picked: ${pick.name} (${pick.categoryLabel}, fit ${pick.fitScore})`);
console.log(`   reason: ${pick.reasonText}`);

console.log("\n2. /api/pitch");
const draft = await post("/api/pitch", {
  brand: pick,
  artists: brands.artists.map((artist) => artist.name),
  event,
});
console.log(`   source: ${draft.source}${draft.model ? ` (${draft.model})` : ""}, ${draft.ms} ms`);
if (draft.note) console.log(`   note: ${draft.note}`);
console.log(`\nSubject: ${draft.subject}\n`);
console.log(draft.body);
console.log(`\n(${draft.body.split(/\s+/).length} words)`);
