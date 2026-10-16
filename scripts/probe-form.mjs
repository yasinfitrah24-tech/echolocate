// One-off probe for the form redesign (City and Genre comboboxes). Calls the
// real Qloo API, at most MAX_CALLS requests (retries included), 2 at a time.
//
// Run from the project root:
//   node --env-file=.env.local scripts/probe-form.mjs
//
// Parts (planned calls):
//   a. Qloo tag ids for 30 music genres          30  -> src/data/music-genres.json
//   -  artist ids for the two test line-ups        5
//   b. brands in small and campus towns            6
//   c. places: POINT(lon lat) + radius vs city     3
//   d. brand categories with vs without a city    12
//   total                                         56
//
// Everything else goes to scripts/probe-form-results.json. Nothing in src/lib
// changes; the city-vs-no-city decision waits for these numbers.

import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "https://hackathon.api.qloo.com";
const KEY = process.env.QLOO_API_KEY;
if (!KEY) {
  console.error("QLOO_API_KEY is not set. Run with --env-file=.env.local");
  process.exit(1);
}

const MAX_CALLS = 60;
const MAX_PARALLEL = 2;
const MUSIC_TAG = "urn:tag:genre:music:";

// ---------- request budget, 2 at a time ----------

let used = 0;
let active = 0;
const waiting = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function slot(task) {
  if (active >= MAX_PARALLEL) await new Promise((resolve) => waiting.push(resolve));
  active += 1;
  try {
    return await task();
  } finally {
    active -= 1;
    waiting.shift()?.();
  }
}

class BudgetError extends Error {}

/** One Qloo GET. Returns parsed JSON, or null when the request failed. */
async function get(path, params) {
  const url = new URL(path, BASE);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  return slot(async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (used >= MAX_CALLS) throw new BudgetError(`Stopped: ${MAX_CALLS} calls used`);
      used += 1;
      const response = await fetch(url, { headers: { "X-Api-Key": KEY, Accept: "application/json" } });
      const text = await response.text();
      if (response.status === 429 || response.status === 503) {
        await sleep(800 * 2 ** attempt);
        continue;
      }
      if (!response.ok) {
        // Status only; the body can echo request details.
        console.error(`  ${path} returned ${response.status}`);
        return null;
      }
      return JSON.parse(text);
    }
    console.error(`  ${path} still rate limited after retries`);
    return null;
  });
}

const entitiesOf = (data) => data?.results?.entities ?? [];
const norm = (text) => text.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");

function distanceKm(aLat, aLon, bLat, bLon) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((bLat - aLat) * rad) / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(((bLon - aLon) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const results = { startedAt: new Date().toISOString() };

// ---------- a. genre tag ids ----------

const GENRES = [
  ["Pop", "pop"],
  ["Indie pop", "indie pop"],
  ["Indie rock", "indie rock"],
  ["Alternative rock", "alternative rock"],
  ["Rock", "rock"],
  ["Punk", "punk"],
  ["Emo", "emo"],
  ["Metal", "metal"],
  ["Hip hop", "hip hop"],
  ["R&B", "r&b"],
  ["Soul", "soul"],
  ["Funk", "funk"],
  ["Jazz", "jazz"],
  ["Blues", "blues"],
  ["Country", "country"],
  ["Americana", "americana"],
  ["Folk", "folk"],
  ["Bluegrass", "bluegrass"],
  ["Singer-songwriter", "singer-songwriter"],
  ["Electronic", "electronic"],
  ["House", "house"],
  ["Techno", "techno"],
  ["EDM", "edm"],
  ["Drum and bass", "drum and bass"],
  ["Latin", "latin"],
  ["Reggaeton", "reggaeton"],
  ["K-pop", "k-pop"],
  ["Reggae", "reggae"],
  ["Gospel", "gospel"],
  ["Classical", "classical"],
];

async function partA() {
  console.log(`\n== a. Genre tags (${GENRES.length} calls) ==`);
  const rows = await Promise.all(
    GENRES.map(async ([label, query]) => {
      const data = await get("/v2/tags", { "filter.query": query, take: 10 });
      const tags = (data?.results?.tags ?? [])
        .map((tag) => ({ id: tag.id, name: tag.name ?? tag.id }))
        .filter((tag) => typeof tag.id === "string" && tag.id.startsWith(MUSIC_TAG));
      const exact = tags.find(
        (tag) => norm(tag.name) === norm(query) || norm(tag.id.slice(MUSIC_TAG.length)) === norm(query),
      );
      const pick = exact ?? tags[0] ?? null;
      return {
        label,
        query,
        tagId: pick?.id ?? null,
        tagName: pick?.name ?? null,
        exact: Boolean(exact),
        others: tags.filter((tag) => tag !== pick).slice(0, 4).map((tag) => tag.name),
      };
    }),
  );
  for (const row of rows) {
    const flag = !row.tagId ? "NOT FOUND" : row.exact ? "ok" : "CHECK: not an exact name";
    console.log(`  ${row.label.padEnd(18)} -> ${row.tagName ?? "-"} [${flag}]`);
  }
  mkdirSync("src/data", { recursive: true });
  writeFileSync("src/data/music-genres.json", `${JSON.stringify(rows, null, 2)}\n`);
  console.log("  wrote src/data/music-genres.json");
  results.genres = rows;
  return rows;
}

// ---------- artists for the test line-ups ----------

const LINE_UPS = {
  indie: { names: ["Phoebe Bridgers", "boygenius", "Clairo"], city: "Austin, TX", age: "24_and_younger" },
  country: { names: ["Zach Bryan", "Kacey Musgraves"], city: "Nashville, TN", age: undefined },
};

async function resolveArtists() {
  console.log("\n== Artist ids (5 calls) ==");
  const out = {};
  for (const [key, lineUp] of Object.entries(LINE_UPS)) {
    const found = await Promise.all(
      lineUp.names.map(async (name) => {
        const data = await get("/search", { query: name, types: "urn:entity:artist", take: 3 });
        const hit = (data?.results ?? []).find((item) => norm(item.name ?? "") === norm(name));
        console.log(`  ${name} -> ${hit ? hit.name : "NOT FOUND (exact)"}`);
        return hit ? hit.entity_id : null;
      }),
    );
    out[key] = found.filter(Boolean);
  }
  return out;
}

// ---------- b. small and campus towns ----------

const TOWNS = ["Storrs, CT", "State College, PA", "Ithaca, NY", "Athens, GA", "Ann Arbor, MI", "Indio, CA"];

async function partB(artistIds) {
  console.log(`\n== b. Brands in small and campus towns (${TOWNS.length} calls, indie line-up) ==`);
  const rows = await Promise.all(
    TOWNS.map(async (town) => {
      const data = await get("/v2/insights", {
        "filter.type": "urn:entity:brand",
        "signal.interests.entities": artistIds.join(","),
        "signal.location.query": town,
        take: 10,
      });
      const names = entitiesOf(data).map((entity) => entity.name);
      return { town, count: data ? names.length : null, top3: names.slice(0, 3) };
    }),
  );
  for (const row of rows) {
    console.log(`  ${row.town.padEnd(18)} ${row.count === null ? "failed" : `${row.count} brands`}  ${row.top3.join(", ")}`);
  }
  results.towns = rows;
}

// ---------- c. places by coordinates + radius ----------

const AUSTIN = { lat: 30.2672, lon: -97.7431 };

async function partC(artistIds) {
  console.log("\n== c. Austin cafes: city name vs POINT + radius (3 calls) ==");
  const base = {
    "filter.type": "urn:entity:place",
    "filter.tags": "urn:tag:genre:place:restaurant:cafe",
    "signal.interests.entities": artistIds.join(","),
    take: 15,
  };
  const point = `POINT(${AUSTIN.lon} ${AUSTIN.lat})`;
  const variants = [
    { label: "city name (today)", params: { "filter.location.query": "Austin, TX" } },
    { label: "POINT + radius 3000", params: { "filter.location": point, "filter.location.radius": 3000 } },
    { label: "POINT + radius 15000", params: { "filter.location": point, "filter.location.radius": 15000 } },
  ];
  const rows = await Promise.all(
    variants.map(async (variant) => {
      const data = await get("/v2/insights", { ...base, ...variant.params });
      const places = entitiesOf(data)
        .map((entity) => ({ name: entity.name, lat: entity.location?.lat, lon: entity.location?.lon }))
        .filter((place) => typeof place.lat === "number" && typeof place.lon === "number")
        .map((place) => ({ ...place, km: distanceKm(AUSTIN.lat, AUSTIN.lon, place.lat, place.lon) }));
      const kms = places.map((place) => place.km).sort((a, b) => a - b);
      return {
        label: variant.label,
        count: data ? entitiesOf(data).length : null,
        medianKm: kms.length ? Number(kms[Math.floor(kms.length / 2)].toFixed(1)) : null,
        maxKm: kms.length ? Number(kms[kms.length - 1].toFixed(1)) : null,
        names: places.map((place) => place.name),
      };
    }),
  );
  for (const row of rows) {
    console.log(
      `  ${row.label.padEnd(22)} ${row.count ?? "failed"} places, median ${row.medianKm ?? "-"} km, max ${row.maxKm ?? "-"} km from downtown`,
    );
  }
  const [city, small, large] = rows;
  console.log(
    `  same list as city name? radius 3000: ${String(small.names) === String(city.names)}, radius 15000: ${String(large.names) === String(city.names)}`,
  );
  console.log("  radius works if the 3000 m list stays within ~3 km and differs from the 15000 m list.");
  results.places = rows;
}

// ---------- d. categories with vs without city ----------

const CATEGORIES = [
  { id: "general", extra: { take: 50 } },
  { id: "drinks", extra: { "filter.tags": "urn:tag:genre:brand:food_and_beverage:drinks", take: 15 } },
  { id: "financial_services", extra: { "filter.tags": "urn:tag:genre:brand:financial_services", take: 15 } },
];

async function partD(artistIdsByLineUp) {
  console.log("\n== d. Categories with vs without city (12 calls) ==");
  const rows = [];
  for (const [key, lineUp] of Object.entries(LINE_UPS)) {
    const ids = artistIdsByLineUp[key];
    if (ids.length === 0) {
      console.log(`  ${key}: no artists found, skipped`);
      continue;
    }
    const pairs = await Promise.all(
      CATEGORIES.map(async (category) => {
        const params = (city) => ({
          "filter.type": "urn:entity:brand",
          "signal.interests.entities": ids.join(","),
          "signal.location.query": city,
          "signal.demographics.age": lineUp.age,
          ...category.extra,
        });
        const [withCity, without] = await Promise.all([get("/v2/insights", params(lineUp.city)), get("/v2/insights", params(undefined))]);
        const a = entitiesOf(withCity).map((entity) => entity.name);
        const b = entitiesOf(without).map((entity) => entity.name);
        const overlap = a.slice(0, 5).filter((name) => b.slice(0, 5).includes(name)).length;
        return { lineUp: key, city: lineUp.city, category: category.id, withCity: a.length, withoutCity: b.length, top5Overlap: overlap, top5With: a.slice(0, 5), top5Without: b.slice(0, 5) };
      }),
    );
    rows.push(...pairs);
  }
  for (const row of rows) {
    console.log(
      `  ${row.lineUp.padEnd(8)} ${row.category.padEnd(19)} with ${row.city}: ${String(row.withCity).padStart(2)}  without: ${String(row.withoutCity).padStart(2)}  top-5 overlap ${row.top5Overlap}/5`,
    );
    console.log(`           with:    ${row.top5With.join(", ")}`);
    console.log(`           without: ${row.top5Without.join(", ")}`);
  }
  results.cityVsNoCity = rows;
}

// ---------- run ----------

try {
  await partA();
  const artistIds = await resolveArtists();
  if (artistIds.indie.length > 0) {
    await partB(artistIds.indie);
    await partC(artistIds.indie);
  } else {
    console.log("\nIndie line-up not found, skipped parts b and c.");
  }
  await partD(artistIds);
} catch (error) {
  if (!(error instanceof BudgetError)) throw error;
  console.error(`\n${error.message}. Later parts were skipped.`);
} finally {
  results.callsUsed = used;
  writeFileSync("scripts/probe-form-results.json", `${JSON.stringify(results, null, 2)}\n`);
  console.log(`\nCalls used: ${used} of ${MAX_CALLS}. Full results: scripts/probe-form-results.json`);
}
