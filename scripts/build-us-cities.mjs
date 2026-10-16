// Builds public/data/us-cities.json for the City combobox. No Qloo calls.
//
// Sources (US Census Bureau, public domain, no API key needed):
//   Coordinates: https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_place_national.zip
//   Population:  https://www2.census.gov/programs-surveys/acs/summary_file/2023/table-based-SF/data/5YRData/acsdt5y2023-b01003.dat
//                (ACS 5-year 2019-2023, table B01003 total population)
//
// Download both, unzip the gazetteer, then from the project root:
//   node scripts/build-us-cities.mjs <folder with the two files>
//
// Keeps places (cities, towns, villages, boroughs and census-designated
// places, so campus towns like Storrs, CT are in) with at least MIN_POPULATION
// people, plus the small campus towns in CAMPUS_TOWNS. Puerto Rico is left
// out. Output rows: [name, state, population, lat, lon], biggest first.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const MIN_POPULATION = 5000;

// Small college towns kept whatever their size. Matched after names are cleaned.
const CAMPUS_TOWNS = [
  "Gambier, OH", "Sewanee, TN", "Williamstown, MA", "Middlebury, VT", "Orono, ME", "Hanover, NH",
  "Durham, NH", "Davidson, NC", "Swarthmore, PA", "Grinnell, IA", "Decorah, IA", "Northfield, MN",
  "Oberlin, OH", "Granville, OH", "Lexington, VA", "Canton, NY", "Potsdam, NY", "Hamilton, NY",
  "Clinton, NY", "Amherst, MA", "Northampton, MA", "Storrs, CT", "Clemson, SC",
  "Oxford, MS", "Oxford, OH", "Boone, NC", "Poultney, VT",
];

// Consolidated city-county names -> the name people type.
const ALIASES = {
  "GA|Athens-Clarke County": "Athens",
  "GA|Augusta-Richmond County": "Augusta",
  "GA|Macon-Bibb County": "Macon",
  "KY|Louisville/Jefferson County": "Louisville",
  "KY|Lexington-Fayette": "Lexington",
  "TN|Nashville-Davidson": "Nashville",
  "HI|Urban Honolulu": "Honolulu",
  "ID|Boise City": "Boise",
  "MT|Butte-Silver Bow": "Butte",
  "MT|Anaconda-Deer Lodge County": "Anaconda",
  "TN|Hartsville/Trousdale County": "Hartsville",
  "CA|San Buenaventura (Ventura)": "Ventura",
  "CA|El Paso de Robles (Paso Robles)": "Paso Robles",
};

const NEW_ENGLAND = new Set(["CT", "MA", "ME", "NH", "RI", "VT"]);

// Census adds the kind of place after the name, always in lower case
// ("Austin city", "Storrs CDP"). Capitalized words stay ("Carson City").
const SUFFIX =
  / (city and borough|consolidated government|unified government|metropolitan government|metro government|urban county|metro township|municipality|corporation|city|town|township|village|borough|CDP|plantation)$/;

function cleanName(raw, state) {
  let name = raw.replace(/ \(balance\)$/, "");
  for (let i = 0; i < 2; i += 1) name = name.replace(SUFFIX, "");
  name = ALIASES[`${state}|${name}`] ?? name.replace(/ \([^)]*\)$/, "");
  // New England towns are not always Census places: some show up as their
  // center ("Amherst Center") or as "Amherst Town".
  if (NEW_ENGLAND.has(state)) name = name.replace(/ (Center|Town)$/, "");
  return name.trim();
}

const folder = process.argv[2];
if (!folder) {
  console.error("Usage: node scripts/build-us-cities.mjs <folder with the Census files>");
  process.exit(1);
}

const population = new Map();
for (const line of readFileSync(join(folder, "acsdt5y2023-b01003.dat"), "utf8").split("\n")) {
  const [geoId, estimate] = line.split("|");
  if (!geoId?.startsWith("1600000US")) continue;
  population.set(geoId.slice(9), Number(estimate));
}

const rows = [];
const lines = readFileSync(join(folder, "2023_Gaz_place_national.txt"), "utf8").split("\n").slice(1);
for (const line of lines) {
  const cols = line.split("\t").map((col) => col.trim());
  if (cols.length < 12) continue;
  const [state, geoId, , rawName] = cols;
  if (state === "PR") continue;
  const people = population.get(geoId);
  if (!Number.isFinite(people)) continue;
  rows.push({
    name: cleanName(rawName, state),
    state,
    people,
    lat: Number(Number(cols[10]).toFixed(3)),
    lon: Number(Number(cols[11]).toFixed(3)),
  });
}

const campus = new Set(CAMPUS_TOWNS);
const keep = rows.filter((row) => row.people >= MIN_POPULATION || campus.has(`${row.name}, ${row.state}`));

// Same name twice in one state (a city and a CDP): keep the bigger one.
const byKey = new Map();
for (const row of keep) {
  const key = `${row.name}, ${row.state}`;
  const existing = byKey.get(key);
  if (!existing || row.people > existing.people) byKey.set(key, row);
}
const cities = [...byKey.values()].sort((a, b) => b.people - a.people);

const missing = CAMPUS_TOWNS.filter((town) => !byKey.has(town));
mkdirSync("public/data", { recursive: true });
const json = JSON.stringify(cities.map((row) => [row.name, row.state, row.people, row.lat, row.lon]));
writeFileSync("public/data/us-cities.json", json);

console.log(`${cities.length} places (>= ${MIN_POPULATION} people, plus campus towns), ${json.length} bytes`);
if (missing.length) console.log(`Campus towns not found as Census places: ${missing.join("; ")}`);
