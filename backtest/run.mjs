// Backtest: do the brands that really sponsored a festival rank high in
// Qloo's brand list for that festival's line-up?
//
// Run from the project root (needs QLOO_API_KEY in .env.local):
//   node --env-file=.env.local backtest/run.mjs
//
// What it does, per festival in backtest/festivals.json:
//   1. Finds the three headliners in Qloo.
//   2. Finds each sponsor in Qloo and reads the brand category tags Qloo gives it.
//   3. Asks Qloo for the top 50 brands in the sponsor's category, for this
//      line-up and city, and looks up where the real sponsor ranks.
//      Two category levels are reported side by side, so the result does not
//      depend on picking a convenient one:
//        broad   = top-level tag, e.g. wine_and_spirits (beer, wine and spirits together)
//        product = second-level tag, e.g. wine_and_spirits:beer (the level the app uses)
//   4. Control: looks up the same sponsor in the lists of the OTHER festivals
//      (where it was not a sponsor). If Qloo only ranked popular brands high
//      everywhere, own-festival and control would look the same.
//
// Output: backtest/results.md and backtest/results.json.
// Responses are cached in the system temp folder, so a rerun is fast and free.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = "https://hackathon.api.qloo.com";
const BRAND_TAG_PREFIX = "urn:tag:genre:brand:";
const TAKE = 50;
const MAX_CONCURRENT = 2;
const MAX_RETRIES = 5;
const here = dirname(fileURLToPath(import.meta.url));
const cachePath = join(tmpdir(), "echolocate-backtest-cache.json");
const apiKey = process.env.QLOO_API_KEY;
if (!apiKey) {
  console.error("QLOO_API_KEY is not set. Run with: node --env-file=.env.local backtest/run.mjs");
  process.exit(1);
}

const festivals = JSON.parse(readFileSync(join(here, "festivals.json"), "utf8"));
const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};
let liveCalls = 0;
let retries = 0;

// ---------- Qloo access: cached, at most 3 at once, retry on 429 ----------

let active = 0;
const waiting = [];
async function withSlot(task) {
  if (active >= MAX_CONCURRENT) await new Promise((resolve) => waiting.push(resolve));
  else active += 1;
  try {
    return await task();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active -= 1;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function qloo(path, params) {
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  const cacheKey = url.pathname + url.search;
  if (cache[cacheKey]) return cache[cacheKey];

  return withSlot(async () => {
    for (let attempt = 0; ; attempt += 1) {
      const response = await fetch(url, {
        headers: { "X-Api-Key": apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
      });
      const text = await response.text();
      if ((response.status === 429 || response.status === 503) && attempt < MAX_RETRIES) {
        retries += 1;
        await sleep(600 * 2 ** attempt + Math.random() * 300);
        continue;
      }
      if (!response.ok) throw new Error(`Qloo ${response.status} for ${cacheKey}: ${text.trim().slice(0, 200)}`);
      const data = JSON.parse(text);
      cache[cacheKey] = data;
      liveCalls += 1;
      if (liveCalls % 20 === 0) {
        writeFileSync(cachePath, JSON.stringify(cache));
        console.log(`  ... ${liveCalls} Qloo calls so far`);
      }
      return data;
    }
  });
}

// ---------- name matching ----------

function tokens(name) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** "exact" when the names are the same, "partial" when one name's words sit inside the other's. */
function nameMatch(a, b) {
  const x = tokens(a);
  const y = tokens(b);
  if (x.length === 0 || y.length === 0) return null;
  if (x.join(" ") === y.join(" ")) return "exact";
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.join("").length < 4) return null;
  for (let i = 0; i + short.length <= long.length; i += 1) {
    if (short.every((word, j) => long[i + j] === word)) return "partial";
  }
  return null;
}

function brandTags(entity) {
  // /v2/insights tags look like { id }, /search tags can look like { tag_id } or { value }.
  return (Array.isArray(entity?.tags) ? entity.tags : [])
    .map((tag) => (typeof tag === "string" ? tag : (tag?.id ?? tag?.tag_id ?? tag?.value ?? tag?.urn)))
    .filter((id) => typeof id === "string" && id.startsWith(BRAND_TAG_PREFIX));
}

const depth = (id) => id.slice(BRAND_TAG_PREFIX.length).split(":").length;

/** The tag the entity literally carries at a level: 1 = broad, 2 = product. Null when it has none. */
function tagAtLevel(tagIds, level) {
  return tagIds.find((id) => depth(id) === level && !id.startsWith(`${BRAND_TAG_PREFIX}ngo`)) ?? null;
}

// ---------- step 1: line-ups ----------

console.log(`Backtest on ${festivals.length} festivals. Cache: ${cachePath}`);
console.log("\n1. Finding headliners in Qloo");
for (const festival of festivals) {
  festival.artists = [];
  festival.missingArtists = [];
  const results = await Promise.all(
    festival.headliners.map((name) => qloo("/search", { query: name, types: "urn:entity:artist", take: 10 })),
  );
  results.forEach((data, index) => {
    const wanted = festival.headliners[index];
    const list = Array.isArray(data.results) ? data.results : [];
    const hit = list.find((item) => nameMatch(item.name ?? "", wanted) === "exact");
    if (hit) festival.artists.push({ id: hit.entity_id, name: hit.name });
    else festival.missingArtists.push(`${wanted} (Qloo returned: ${list.slice(0, 4).map((item) => item.name).join(" | ") || "nothing"})`);
  });
  console.log(`  ${festival.festival} ${festival.year}: ${festival.artists.map((a) => a.name).join(", ")}`);
  for (const missing of festival.missingArtists) console.log(`     MISSING ${missing}`);
}

// ---------- step 2: sponsors ----------

console.log("\n2. Finding sponsors in Qloo");
const sponsorNames = [...new Set(festivals.flatMap((f) => f.sponsors.map((s) => s.name)))];
const lookup = new Map();
await Promise.all(
  sponsorNames.map(async (name) => {
    const data = await qloo("/search", { query: name, types: "urn:entity:brand", take: 5 });
    const list = Array.isArray(data.results) ? data.results : [];
    let found = null;
    for (const kind of ["exact", "partial"]) {
      const hit = list.find((item) => nameMatch(item.name ?? "", name) === kind);
      if (hit) {
        found = { id: hit.entity_id, qlooName: hit.name, match: kind, tags: brandTags(hit) };
        break;
      }
    }
    lookup.set(name, found);
  }),
);
const foundList = [...lookup.values()].filter(Boolean);
console.log(`  ${sponsorNames.length} unique sponsors, ${foundList.length} found in Qloo`);
console.log(`  with a broad category tag: ${foundList.filter((v) => tagAtLevel(v.tags, 1)).length}, with a product category tag: ${foundList.filter((v) => tagAtLevel(v.tags, 2)).length}`);

// ---------- step 3: category lists per festival ----------

const LEVELS = [
  { id: "broad", level: 1, label: "Broad category (top-level tag)" },
  { id: "product", level: 2, label: "Product category (second-level tag, the level the app uses)" },
];
const tagsInUse = [...new Set(foundList.flatMap((v) => [tagAtLevel(v.tags, 1), tagAtLevel(v.tags, 2)]).filter(Boolean))].sort();
console.log(`\n3. Asking Qloo for the top ${TAKE} brands per category, per festival (${tagsInUse.length} category tags x ${festivals.length} festivals)`);

const lists = new Map(); // `${festivalIndex}|${tag}` -> { ids, usable, reason }

async function fetchLists(festival, index, useCity) {
  let total = 0;
  await Promise.all(
    tagsInUse.map(async (tag) => {
      const data = await qloo("/v2/insights", {
        "filter.type": "urn:entity:brand",
        "filter.tags": tag,
        "signal.interests.entities": festival.artists.map((a) => a.id).join(","),
        "signal.location.query": useCity ? festival.city : undefined,
        take: TAKE,
      });
      const entities = Array.isArray(data?.results?.entities) ? data.results.entities : [];
      total += entities.length;
      // A list is unusable when it is empty, or when most brands in it do not carry
      // the tag (Qloo ignores a filter it does not understand, silently).
      const offTag = entities.filter((entity) => !brandTags(entity).some((id) => id === tag || id.startsWith(`${tag}:`))).length;
      let reason = null;
      if (entities.length === 0) reason = "empty";
      else if (offTag > entities.length / 2) reason = "filter ignored";
      lists.set(`${index}|${tag}`, { ids: entities.map((entity) => entity.entity_id), usable: reason === null, reason });
    }),
  );
  return total;
}

await Promise.all(
  festivals.map(async (festival, index) => {
    festival.cityDropped = false;
    if (festival.artists.length === 0) return;
    const total = await fetchLists(festival, index, true);
    // Same rule as the app: Qloo returns nothing at all for a place it has no
    // taste data for (Indio, CA), so fall back to the line-up alone.
    if (total === 0) {
      festival.cityDropped = (await fetchLists(festival, index, false)) > 0;
    }
  }),
);
const dropped = festivals.filter((f) => f.cityDropped);
if (dropped.length) console.log(`  no Qloo data for the city, used the line-up alone: ${dropped.map((f) => `${f.festival} (${f.city})`).join(", ")}`);
writeFileSync(cachePath, JSON.stringify(cache));

const tagHealth = tagsInUse.map((tag) => {
  const perFestival = festivals.map((_, index) => lists.get(`${index}|${tag}`)).filter(Boolean);
  return {
    tag: tag.slice(BRAND_TAG_PREFIX.length),
    usable: perFestival.filter((l) => l.usable).length,
    total: perFestival.length,
    sizes: perFestival.map((l) => l.ids.length),
    reasons: [...new Set(perFestival.map((l) => l.reason).filter(Boolean))],
  };
});
const brokenTags = tagHealth.filter((t) => t.usable < t.total);
console.log(`  usable for every festival: ${tagHealth.length - brokenTags.length} of ${tagHealth.length} tags`);
for (const t of brokenTags) console.log(`     ${t.tag}: usable ${t.usable}/${t.total} (${t.reasons.join(", ")}; sizes ${t.sizes.join(",")})`);

// ---------- step 4: score, once per category level ----------

const hit = (rank, n) => rank !== null && rank <= n;
const pct = (part, whole) => (whole === 0 ? "n/a" : `${Math.round((100 * part) / whole)}%`);
const count = (list, test) => list.filter(test).length;

function scoreLevel(level) {
  const rows = [];
  festivals.forEach((festival, index) => {
    for (const sponsor of festival.sponsors) {
      const base = { festival: festival.festival, year: festival.year, sponsor: sponsor.name, category: sponsor.category };
      const found = lookup.get(sponsor.name);
      if (!found) {
        rows.push({ ...base, status: "not_in_qloo" });
        continue;
      }
      const tag = tagAtLevel(found.tags, level);
      if (!tag) {
        rows.push({ ...base, status: "no_tag_at_level", qlooName: found.qlooName });
        continue;
      }
      const own = lists.get(`${index}|${tag}`);
      if (!own || !own.usable) {
        rows.push({ ...base, status: "list_unusable", qlooName: found.qlooName, tag: tag.slice(BRAND_TAG_PREFIX.length) });
        continue;
      }
      const position = own.ids.indexOf(found.id);
      // Control: the same brand in other festivals' lists, leaving out festivals it also sponsored.
      const controlRanks = [];
      festivals.forEach((other, otherIndex) => {
        if (otherIndex === index) return;
        if (other.sponsors.some((s) => lookup.get(s.name)?.id === found.id)) return;
        const list = lists.get(`${otherIndex}|${tag}`);
        if (!list || !list.usable) return;
        const at = list.ids.indexOf(found.id);
        controlRanks.push(at === -1 ? null : at + 1);
      });
      rows.push({
        ...base,
        status: "tested",
        qlooName: found.qlooName,
        match: found.match,
        tag: tag.slice(BRAND_TAG_PREFIX.length),
        listSize: own.ids.length,
        rank: position === -1 ? null : position + 1,
        controlRanks,
      });
    }
  });
  return rows;
}

function summary(list) {
  const controls = list.flatMap((row) => row.controlRanks);
  return {
    n: list.length,
    top5: count(list, (row) => hit(row.rank, 5)),
    top10: count(list, (row) => hit(row.rank, 10)),
    top25: count(list, (row) => hit(row.rank, 25)),
    top50: count(list, (row) => hit(row.rank, 50)),
    controlN: controls.length,
    controlTop10: count(controls, (rank) => hit(rank, 10)),
    controlTop25: count(controls, (rank) => hit(rank, 25)),
  };
}

function line(label, s) {
  return `| ${label} | ${s.n} | ${s.top5} (${pct(s.top5, s.n)}) | ${s.top10} (${pct(s.top10, s.n)}) | ${s.top25} (${pct(s.top25, s.n)}) | ${s.top50} (${pct(s.top50, s.n)}) | ${pct(s.controlTop10, s.controlN)} | ${pct(s.controlTop25, s.controlN)} |`;
}

const header = "| | Tested | Top 5 | Top 10 | Top 25 | Top 50 | Control top 10 | Control top 25 |\n|---|---|---|---|---|---|---|---|";
const md = [];
md.push("# Backtest: real festival sponsors in Qloo's brand ranking", "");
md.push(`Run ${new Date().toISOString().slice(0, 10)}. ${festivals.length} US festivals, ${festivals.reduce((sum, f) => sum + f.sponsors.length, 0)} sponsor rows. Data and sources: \`backtest/festivals.json\`.`, "");
md.push("For each sponsor found in Qloo, we asked Qloo for the top 50 brands in the sponsor's own category, for that festival's three headliners and city, and looked up the sponsor's rank.", "");
md.push("**Control** is the same brand's rank in the other festivals' lists (festivals it did not sponsor). It shows how often a brand lands near the top just by being popular.", "");
md.push("Two category levels are shown so the result does not hinge on a convenient choice. Broad lists mix very different products (beer, wine and spirits in one list of 50), so they are the harder test.", "");

const output = { ranAt: new Date().toISOString(), levels: {} };
console.log("\n4. Result");
for (const { id, level, label } of LEVELS) {
  const rows = scoreLevel(level);
  const tested = rows.filter((row) => row.status === "tested");
  const all = summary(tested);
  const full = summary(tested.filter((row) => row.listSize >= TAKE));
  const exact = summary(tested.filter((row) => row.match === "exact"));
  output.levels[id] = { all, full, exact, rows };

  const groups = (key) => {
    const map = new Map();
    for (const row of tested) map.set(row[key], [...(map.get(row[key]) ?? []), row]);
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  };

  md.push(`## ${label}`, "");
  md.push(`Tested ${tested.length} sponsor rows. Left out: ${count(rows, (r) => r.status === "not_in_qloo")} not found in Qloo, ${count(rows, (r) => r.status === "no_tag_at_level")} with no tag at this level, ${count(rows, (r) => r.status === "list_unusable")} whose category list was empty or ignored the filter.`, "");
  md.push(header, line("All tested", all), line("Full lists only (50 brands)", full), line("Exact name matches only", exact), "");
  md.push("By category:", "", header);
  for (const [tag, list] of groups("tag")) md.push(line(tag, summary(list)));
  md.push("", "By festival:", "", header);
  for (const [name, list] of groups("festival")) md.push(line(name, summary(list)));
  md.push("", "Sponsors ranked in the top 10 for their own festival:", "");
  md.push("| Festival | Sponsor | Category | Rank | Rank at festivals it did not sponsor |", "|---|---|---|---|---|");
  for (const row of tested.filter((r) => hit(r.rank, 10)).sort((a, b) => a.rank - b.rank)) {
    const control = row.controlRanks.map((rank) => (rank === null ? ">50" : `#${rank}`)).join(", ") || "none";
    md.push(`| ${row.festival} ${row.year} | ${row.sponsor}${row.match === "partial" ? ` (Qloo: ${row.qlooName})` : ""} | ${row.tag} | #${row.rank} of ${row.listSize} | ${control} |`);
  }
  md.push("");

  console.log(`  ${id.toUpperCase()}: tested ${all.n}`);
  console.log(`     own festival: top 5 ${all.top5} (${pct(all.top5, all.n)}), top 10 ${all.top10} (${pct(all.top10, all.n)}), top 25 ${all.top25} (${pct(all.top25, all.n)}), top 50 ${all.top50} (${pct(all.top50, all.n)})`);
  console.log(`     control:      top 10 ${pct(all.controlTop10, all.controlN)}, top 25 ${pct(all.controlTop25, all.controlN)}  (${all.controlN} lookups)`);
  console.log(`     full lists only: tested ${full.n}, top 10 ${full.top10} (${pct(full.top10, full.n)}), control top 10 ${pct(full.controlTop10, full.controlN)}`);
  console.log(`     left out: not in Qloo ${count(rows, (r) => r.status === "not_in_qloo")}, no tag at this level ${count(rows, (r) => r.status === "no_tag_at_level")}, list unusable ${count(rows, (r) => r.status === "list_unusable")}`);
  console.log(`     by category: ${groups("tag").map(([tag, list]) => `${tag} ${count(list, (r) => hit(r.rank, 10))}/${list.length}`).join(", ")}`);
}

md.push("## Category lists", "");
md.push("| Category tag | Usable lists | List sizes per festival | Problem |", "|---|---|---|---|");
for (const t of tagHealth) md.push(`| ${t.tag} | ${t.usable}/${t.total} | ${t.sizes.join(", ")} | ${t.reasons.join(", ") || ""} |`);
md.push("", "## Read this before quoting a number", "");
md.push("- These are large festivals. Echolocate is for small events, where no public sponsor list exists to test against.");
md.push("- Sponsors are bought for many reasons (price, distributor deals, rival exclusivity). A real sponsor missing from the list is not proof the list is wrong.");
md.push("- The own-festival query includes the festival's city, and so do the control queries for their own cities. Part of any gap is location, not line-up.");
if (dropped.length) md.push(`- Qloo returned nothing for the city of ${dropped.map((f) => `${f.festival} (${f.city})`).join(" and ")}, so those lists use the line-up alone, the same fallback the app uses.`);
md.push("- Short lists make a top-10 finish easy. The \"Full lists only\" rows remove them.");
md.push("- Both category levels are reported. Quoting only the better one would be cherry-picking.");
md.push("- This does not compare Qloo with a language model on its own.");
if (festivals.some((f) => f.missingArtists.length)) {
  md.push(`- Headliners not found in Qloo: ${festivals.filter((f) => f.missingArtists.length).map((f) => `${f.festival}: ${f.missingArtists.join("; ")}`).join(" / ")}.`);
}

output.tagHealth = tagHealth;
writeFileSync(join(here, "results.md"), `${md.join("\n")}\n`);
writeFileSync(join(here, "results.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(`\n  Qloo calls this run: ${liveCalls} (retries after rate limit: ${retries})`);
console.log("Saved backtest/results.md and backtest/results.json");
