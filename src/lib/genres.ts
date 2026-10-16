// The music genres offered in the form, each with its Qloo tag id
// (looked up once by scripts/probe-form.mjs and probe-country.mjs, then
// curated by hand in src/data/music-genres.json). Picking one of these skips
// the Qloo tag search. Safe to import from client components.

import data from "@/data/music-genres.json";

export interface MusicGenre {
  label: string;
  tagId: string;
  /** Other words people type for it, e.g. "rap" for Hip hop. */
  also: string[];
}

/** Entries without a tag id yet are left out. */
export const MUSIC_GENRES: readonly MusicGenre[] = data.filter(
  (genre): genre is MusicGenre => typeof genre.tagId === "string",
);

function key(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export function findGenreByLabel(text: string): MusicGenre | null {
  const wanted = key(text);
  return MUSIC_GENRES.find((genre) => key(genre.label) === wanted) ?? null;
}

export function findGenreByTagId(tagId: unknown): MusicGenre | null {
  return MUSIC_GENRES.find((genre) => genre.tagId === tagId) ?? null;
}
