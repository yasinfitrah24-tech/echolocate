// Server-side lookup in the US city list the City field suggests from
// (public/data/us-cities.json). A city picked from that list has coordinates
// and a population, so places can be searched by POINT + radius. Typed
// cities that are not in the list keep the old city-name search.
//
// Server only: the client loads the same file over HTTP when the field is
// focused, so importing this module in a client component would ship the
// list twice.

import rows from "../../public/data/us-cities.json";

export interface UsCity {
  label: string;
  population: number;
  lat: number;
  lon: number;
}

/** Same normalization as the City combobox, so "austin , tx" finds Austin, TX. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

let byKey: Map<string, UsCity> | null = null;

export function findUsCity(text: string): UsCity | null {
  if (!byKey) {
    byKey = new Map();
    for (const [name, state, population, lat, lon] of rows as unknown as [string, string, number, number, number][]) {
      const label = `${name}, ${state}`;
      byKey.set(normalize(label), { label, population, lat, lon });
    }
  }
  return byKey.get(normalize(text)) ?? null;
}

/** How far around the city to look for local places (agreed 16 Oct). */
export function placeRadiusKm(population: number): number {
  if (population < 50_000) return 5;
  if (population <= 500_000) return 10;
  return 15;
}
