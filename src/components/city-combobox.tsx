"use client";

// City field with suggestions from a list of US places (Census data,
// public/data/us-cities.json, built by scripts/build-us-cities.mjs).
// Picking a suggestion sends Qloo one exact "City, ST" string. Typing anything
// else is still allowed (cities outside the US, places not in the list); a
// small note says so.

import { useState } from "react";
import { Combobox, isOption, makeOption, type ComboOption } from "./combobox";

/** [name, state, population, lat, lon], biggest first. */
type CityRow = [string, string, number, number, number];

let cityList: Promise<ComboOption[]> | null = null;

/** Loads the list once per page, the first time a city field is used. */
function loadCities(): Promise<ComboOption[]> {
  cityList ??= fetch("/data/us-cities.json")
    .then((response) => {
      if (!response.ok) throw new Error(`City list returned ${response.status}`);
      return response.json() as Promise<CityRow[]>;
    })
    .then((rows) => rows.map(([name, state]) => makeOption(`${name}, ${state}`)))
    .catch((error: unknown) => {
      // Let a later focus try again; the field still works as plain text.
      cityList = null;
      throw error;
    });
  return cityList;
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
  const [cities, setCities] = useState<ComboOption[] | null>(null);
  const [failed, setFailed] = useState(false);

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

  let note: string | null = null;
  if (failed) {
    note = "City suggestions did not load. You can still type the city, like “Austin, TX”.";
  } else if (cities && value.trim() && !isOption(cities, value)) {
    note = /^[^,]+$/.test(value.trim())
      ? "Pick a city from the list, so Qloo gets the right one. Outside the US? Keep what you typed."
      : "Not in our US city list. That is fine; Qloo may just have less data for it.";
  }

  return (
    <Combobox
      id={id}
      value={value}
      onChange={onChange}
      options={cities}
      className={className}
      placeholder="e.g. Austin, TX"
      note={note}
      onFirstFocus={load}
    />
  );
}
