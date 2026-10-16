"use client";

// "What kind of music?" field. Suggests the curated genres (each with a known
// Qloo tag id); anything else typed is looked up in Qloo on search.

import { MUSIC_GENRES } from "@/lib/genres";
import { Combobox, isOption, makeOption } from "./combobox";

const OPTIONS = MUSIC_GENRES.map((genre) => makeOption(genre.label, genre.also));

export function GenreCombobox({
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
  const note =
    value.trim() && !isOption(OPTIONS, value)
      ? "Not in our list. We will look it up in Qloo and show what it matched."
      : null;

  return (
    <Combobox
      id={id}
      value={value}
      onChange={onChange}
      options={OPTIONS}
      className={className}
      placeholder="e.g. Indie pop"
      note={note}
      showAllWhenEmpty
    />
  );
}
