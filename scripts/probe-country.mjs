// Finds the Qloo music tag for Country, which probe-form.mjs missed. 2 calls.
//
// Run from the project root:
//   node --env-file=.env.local scripts/probe-country.mjs
//
// "country" with take 10 returned no music tag: other tags with "country" in
// the name fill the list. So: the same query with a longer list, and
// "country music".

const BASE = "https://hackathon.api.qloo.com";
const KEY = process.env.QLOO_API_KEY;
if (!KEY) {
  console.error("QLOO_API_KEY is not set. Run with --env-file=.env.local");
  process.exit(1);
}

const MUSIC_TAG = "urn:tag:genre:music:";

for (const [query, take] of [
  ["country", 50],
  ["country music", 20],
]) {
  const url = new URL("/v2/tags", BASE);
  url.searchParams.set("filter.query", query);
  url.searchParams.set("take", String(take));
  const response = await fetch(url, { headers: { "X-Api-Key": KEY, Accept: "application/json" } });
  if (!response.ok) {
    console.log(`"${query}": Qloo returned ${response.status}`);
    continue;
  }
  const tags = (await response.json())?.results?.tags ?? [];
  const music = tags.filter((tag) => typeof tag.id === "string" && tag.id.startsWith(MUSIC_TAG));
  console.log(`\n"${query}" (take ${take}): ${tags.length} tags, ${music.length} music`);
  for (const tag of music.slice(0, 12)) console.log(`  ${tag.id}  (${tag.name})`);
  if (music.length === 0) console.log(`  first tags: ${tags.slice(0, 8).map((tag) => tag.id).join(", ")}`);
}
