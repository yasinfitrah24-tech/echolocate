"use client";

// City input with suggestions from a list of US places (Census data,
// public/data/us-cities.json, built by scripts/build-us-cities.mjs).
// Picking a suggestion sends Qloo one exact "City, ST" string. Typing anything
// else is still allowed (cities outside the US, places not in the list); a
// small note says so.

import { useId, useState, type KeyboardEvent } from "react";

/** [name, state, population, lat, lon], biggest first. */
type CityRow = [string, string, number, number, number];

interface City {
  label: string;
  key: string;
  /** Same as key without the comma, so "austin tx" also matches. */
  loose: string;
  /** Each word of the name, for matches inside a name ("arbor" -> Ann Arbor). */
  words: string[];
}

const MAX_SUGGESTIONS = 8;

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

let cityList: Promise<City[]> | null = null;

/** Loads the list once per page, the first time a city field is used. */
function loadCities(): Promise<City[]> {
  cityList ??= fetch("/data/us-cities.json")
    .then((response) => {
      if (!response.ok) throw new Error(`City list returned ${response.status}`);
      return response.json() as Promise<CityRow[]>;
    })
    .then((rows) =>
      rows.map(([name, state]) => {
        const label = `${name}, ${state}`;
        const key = normalize(label);
        return { label, key, loose: key.replace(",", ""), words: normalize(name).split(/[\s-]+/) };
      }),
    )
    .catch((error: unknown) => {
      // Let a later focus try again; the field still works as plain text.
      cityList = null;
      throw error;
    });
  return cityList;
}

function suggest(cities: City[], query: string): City[] {
  const q = normalize(query);
  if (!q) return [];
  const starts: City[] = [];
  const inside: City[] = [];
  for (const city of cities) {
    if (city.key.startsWith(q) || city.loose.startsWith(q)) {
      starts.push(city);
      if (starts.length === MAX_SUGGESTIONS) break;
    } else if (inside.length < MAX_SUGGESTIONS && city.words.slice(1).some((word) => word.startsWith(q))) {
      inside.push(city);
    }
  }
  return [...starts, ...inside].slice(0, MAX_SUGGESTIONS);
}

export function CityCombobox({
  id,
  value,
  onChange,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  className: string;
}) {
  const listId = useId();
  const [cities, setCities] = useState<City[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const suggestions = cities && open ? suggest(cities, value) : [];
  const showList = suggestions.length > 0;
  const known = cities?.some((city) => city.key === normalize(value)) ?? true;

  function load() {
    if (cities) return;
    loadCities().then(
      (list) => {
        setCities(list);
        setFailed(false);
      },
      () => setFailed(true),
    );
  }

  function pick(city: City) {
    onChange(city.label);
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(0);
        return;
      }
      if (!showList) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (index + step + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" && showList) {
      // Pick the highlighted city instead of submitting the form.
      event.preventDefault();
      pick(suggestions[Math.min(active, suggestions.length - 1)]);
    } else if (event.key === "Escape" && open) {
      setOpen(false);
    }
  }

  let note: string | null = null;
  if (failed) {
    note = "City suggestions did not load. You can still type the city, like “Austin, TX”.";
  } else if (!open && value.trim() && !known) {
    note = /^[^,]+$/.test(value.trim())
      ? "Pick a city from the list, so Qloo gets the right one. Outside the US? Keep what you typed."
      : "Not in our US city list. That is fine; Qloo may just have less data for it.";
  }

  return (
    <div className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        className={className}
        value={value}
        placeholder="e.g. Austin, TX"
        autoComplete="off"
        onFocus={() => {
          load();
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-[1000] mt-1 max-h-72 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg"
        >
          {suggestions.map((city, index) => (
            <li
              key={city.label}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              // mousedown, not click: it runs before the input loses focus.
              onMouseDown={(event) => {
                event.preventDefault();
                pick(city);
              }}
              onMouseEnter={() => setActive(index)}
              className={`cursor-pointer px-3 py-2 ${index === active ? "bg-zinc-100" : ""}`}
            >
              {city.label}
            </li>
          ))}
        </ul>
      )}
      {note && <p className="mt-1 text-xs text-zinc-500">{note}</p>}
    </div>
  );
}
