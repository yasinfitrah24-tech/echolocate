"use client";

// The whole first version of the app on one page: form -> brands -> pitch draft.
// Rough on purpose; design comes in the 16-22 Oct pass.

import { useState, type FormEvent } from "react";
import { ADMISSIONS, AUDIENCE_AGES, DEFAULT_ADMISSION, findAdmission } from "@/lib/audience";
import { EMPTY_DETAILS, onePagerAllowed, type OnePagerDetails, type SearchFacts } from "@/lib/one-pager";
import type { ArtistMatch, Brand, BrandCategory, QlooCall } from "@/lib/qloo";
import { LocalSponsors } from "./local-sponsors";
import { OnePagerPanel } from "./one-pager-panel";

interface ConfirmedArtist {
  entityId: string;
  name: string;
}

interface BrandsResponse {
  input: {
    city: string | null;
    cityDropped: boolean;
    genre: string | null;
    age: string | null;
    admission: string;
    includeAlcohol: boolean;
    alcoholBlocked: boolean;
  };
  artists: ConfirmedArtist[];
  genreTags: { id: string; name: string }[];
  unresolved: { query: string; candidates: ArtistMatch[] }[];
  categories: BrandCategory[];
  calls: QlooCall[];
  tookMs: number;
}

interface PitchResponse {
  subject: string;
  body: string;
  source: "deepseek" | "template";
  model: string | null;
  note: string | null;
}

const AGE_OPTIONS = [
  { value: "", label: "Any age" },
  ...AUDIENCE_AGES.map((option) => ({ value: option.id as string, label: option.label })),
];

const EXAMPLE = {
  eventName: "Spring Quad Fest",
  artistsText: "Phoebe Bridgers, boygenius, Clairo",
  city: "Austin, TX",
  age: "24_and_younger",
  admission: "all_ages",
  crowdSize: "800",
};

const TOP_PER_CATEGORY = 5;

function splitNames(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none";
const labelClass = "mb-1 block text-sm font-medium text-zinc-800";

export function SponsorFinder() {
  const [eventName, setEventName] = useState("");
  const [artistsText, setArtistsText] = useState("");
  const [picked, setPicked] = useState<ConfirmedArtist[]>([]);
  const [genre, setGenre] = useState("");
  const [city, setCity] = useState("");
  const [age, setAge] = useState("");
  const [crowdSize, setCrowdSize] = useState("");
  const [admission, setAdmission] = useState<string>(DEFAULT_ADMISSION.id);
  // Only takes effect for a 21+ event; the box is locked otherwise.
  const [wantsAlcohol, setWantsAlcohol] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BrandsResponse | null>(null);
  // Changes with every successful search, so the local sponsors map reloads.
  const [searchId, setSearchId] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [pitchFor, setPitchFor] = useState<string | null>(null);
  const [pitchLoading, setPitchLoading] = useState(false);
  const [pitch, setPitch] = useState<PitchResponse | null>(null);
  const [pitchError, setPitchError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [onePagerFor, setOnePagerFor] = useState<string | null>(null);
  // Kept across brands, so the organizer types their details once.
  const [onePagerDetails, setOnePagerDetails] = useState<OnePagerDetails>(EMPTY_DETAILS);

  const alcoholBlocked = !(findAdmission(admission) ?? DEFAULT_ADMISSION).alcoholAllowed;
  const includeAlcohol = !alcoholBlocked && wantsAlcohol;

  async function findBrands(names: string[], confirmed: ConfirmedArtist[]) {
    setLoading(true);
    setError(null);
    setPitchFor(null);
    setPitch(null);
    setOnePagerFor(null);
    try {
      const response = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistNames: names,
          artists: confirmed,
          genre: genre.trim() || undefined,
          city: city.trim() || undefined,
          age: age || undefined,
          admission,
          includeAlcohol,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setResult(null);
        setError(data.error ?? "Something went wrong");
        return;
      }
      setResult(data as BrandsResponse);
      setSearchId((id) => id + 1);
      setExpanded({});
    } catch {
      setResult(null);
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void findBrands(splitNames(artistsText), picked);
  }

  function fillExample() {
    setEventName(EXAMPLE.eventName);
    setArtistsText(EXAMPLE.artistsText);
    setPicked([]);
    setGenre("");
    setCity(EXAMPLE.city);
    setAge(EXAMPLE.age);
    setCrowdSize(EXAMPLE.crowdSize);
    setAdmission(EXAMPLE.admission);
    setWantsAlcohol(true);
  }

  /** The user confirms which artist a typed name meant. */
  function confirmCandidate(query: string, candidate: ArtistMatch) {
    const nextPicked = [...picked, { entityId: candidate.entityId, name: candidate.name }];
    const nextNames = splitNames(artistsText).filter(
      (name) => name.toLowerCase() !== query.toLowerCase(),
    );
    setPicked(nextPicked);
    setArtistsText(nextNames.join(", "));
    void findBrands(nextNames, nextPicked);
  }

  function removePicked(entityId: string) {
    setPicked(picked.filter((artist) => artist.entityId !== entityId));
  }

  async function draftPitch(
    key: string,
    brand: { name: string; reasonText: string },
    categoryLabel: string,
  ) {
    setPitchFor(key);
    setPitch(null);
    setPitchError(null);
    setPitchLoading(true);
    setCopied(false);
    try {
      const response = await fetch("/api/pitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: { name: brand.name, categoryLabel, reasonText: brand.reasonText },
          artists: result?.artists.map((artist) => artist.name) ?? [],
          // City, age, admission and genre come from the search the brands were
          // found with (checked by the server), not from the form as it is now.
          event: {
            name: eventName.trim() || undefined,
            city: result?.input.city ?? undefined,
            crowdSize: crowdSize.trim() || undefined,
            age: result?.input.age ?? undefined,
            admission: result?.input.admission,
            genre: result?.input.genre ?? undefined,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setPitchError(data.error ?? "Could not write the pitch");
        return;
      }
      setPitch(data as PitchResponse);
    } catch {
      setPitchError("Could not reach the server. Try again.");
    } finally {
      setPitchLoading(false);
    }
  }

  async function copyPitch() {
    if (!pitch) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${pitch.subject}\n\n${pitch.body}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  /** Facts shared by the pitch and the one-pager. */
  const searchFacts: SearchFacts | null = result
    ? {
        eventName: eventName.trim() || null,
        crowdSize: crowdSize.trim() ? Number(crowdSize) : null,
        city: result.input.city,
        cityDropped: result.input.cityDropped,
        age: result.input.age,
        admission: result.input.admission,
        genre: result.input.genre,
        artists: result.artists.map((artist) => artist.name),
        genreTags: result.genreTags.map((tag) => tag.name),
      }
    : null;

  /** Alcohol brands need a 21+ event, both in the search and in the form as it is now. */
  function brandAllowed(brand: Brand): boolean {
    return (
      result !== null && onePagerAllowed(brand, result.input.admission) && onePagerAllowed(brand, admission)
    );
  }

  const brandCount = result?.categories.reduce((sum, category) => sum + category.brands.length, 0) ?? 0;

  return (
    <div className="min-h-screen w-full bg-zinc-50 text-zinc-900">
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Echolocate</h1>
          <p className="mt-1 text-lg text-zinc-600">Find sponsors your crowd already loves.</p>
        </header>

        <form onSubmit={onSubmit} className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Your event</h2>
            <button
              type="button"
              onClick={fillExample}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Try an example
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="artists" className={labelClass}>
                Line-up
              </label>
              <input
                id="artists"
                className={inputClass}
                value={artistsText}
                onChange={(event) => setArtistsText(event.target.value)}
                placeholder="Artist names, separated by commas"
                autoComplete="off"
              />
              {picked.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {picked.map((artist) => (
                    <li
                      key={artist.entityId}
                      className="flex items-center gap-1 rounded-full bg-zinc-900 py-1 pl-3 pr-1 text-xs font-medium text-white"
                    >
                      {artist.name}
                      <button
                        type="button"
                        onClick={() => removePicked(artist.entityId)}
                        aria-label={`Remove ${artist.name}`}
                        className="rounded-full px-1.5 text-zinc-300 hover:text-white"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="genre" className={labelClass}>
                Genre <span className="font-normal text-zinc-500">(if your artists are not found)</span>
              </label>
              <input
                id="genre"
                className={inputClass}
                value={genre}
                onChange={(event) => setGenre(event.target.value)}
                placeholder="e.g. indie pop"
                autoComplete="off"
              />
            </div>

            <div>
              <label htmlFor="event-name" className={labelClass}>
                Event name
              </label>
              <input
                id="event-name"
                className={inputClass}
                value={eventName}
                onChange={(event) => setEventName(event.target.value)}
                placeholder="e.g. Spring Quad Fest"
                autoComplete="off"
              />
            </div>

            <div>
              <label htmlFor="city" className={labelClass}>
                City
              </label>
              <input
                id="city"
                className={inputClass}
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="e.g. Austin, TX"
                autoComplete="off"
              />
            </div>

            <div>
              <label htmlFor="age" className={labelClass}>
                Audience age
              </label>
              <select
                id="age"
                className={inputClass}
                value={age}
                onChange={(event) => setAge(event.target.value)}
              >
                {AGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="admission" className={labelClass}>
                Admission
              </label>
              <select
                id="admission"
                className={inputClass}
                value={admission}
                onChange={(event) => setAdmission(event.target.value)}
              >
                {ADMISSIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="crowd" className={labelClass}>
                Expected crowd
              </label>
              <input
                id="crowd"
                className={inputClass}
                value={crowdSize}
                onChange={(event) => setCrowdSize(event.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 800"
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
          </div>

          <label
            className={`mt-4 flex items-center gap-2 text-sm ${alcoholBlocked ? "text-zinc-400" : "text-zinc-700"}`}
          >
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={includeAlcohol}
              disabled={alcoholBlocked}
              onChange={(event) => setWantsAlcohol(event.target.checked)}
            />
            Include alcohol brands (beer and spirits)
          </label>
          {alcoholBlocked && (
            <p className="mt-1 text-xs text-zinc-500">
              Alcohol brands only show for 21+ events.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400 sm:w-auto"
          >
            {loading ? "Finding sponsors…" : "Find sponsors"}
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        )}

        {result && (
          <section className="mt-8" aria-live="polite">
            <p className="text-sm text-zinc-600">
              {brandCount} brands in {result.categories.length} categories for fans of{" "}
              <span className="font-medium text-zinc-900">
                {[...result.artists.map((artist) => artist.name), ...result.genreTags.map((tag) => tag.name)].join(", ")}
              </span>
              . Found in {(result.tookMs / 1000).toFixed(1)} s.
            </p>

            {result.input.cityDropped && (
              <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Qloo has no taste data for &ldquo;{result.input.city}&rdquo;, so these brands are matched to
                the line-up alone. Try the nearest larger city to bring in local favourites.
              </p>
            )}

            {brandCount === 0 && (
              <p className="mt-4 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
                Qloo returned no brands for this line-up. Check the artist names, or add a genre.
              </p>
            )}

            {result.unresolved.map((item) => (
              <div key={item.query} className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {item.candidates.length === 0 ? (
                  <p>
                    We could not find &ldquo;{item.query}&rdquo; in Qloo, so it was left out. Adding a genre helps cover it.
                  </p>
                ) : (
                  <>
                    <p>We left out &ldquo;{item.query}&rdquo; because the match was not exact. Did you mean:</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.candidates.map((candidate) => (
                        <button
                          key={candidate.entityId}
                          type="button"
                          onClick={() => confirmCandidate(item.query, candidate)}
                          disabled={loading}
                          className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium hover:bg-amber-100 disabled:opacity-50"
                        >
                          {candidate.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}

            <div className="mt-5 space-y-5">
              {result.categories.map((category) => {
                const showAll = expanded[category.id] ?? false;
                const brands = showAll ? category.brands : category.brands.slice(0, TOP_PER_CATEGORY);
                return (
                  <div key={category.id} className="rounded-xl border border-zinc-200 bg-white">
                    <h3 className="border-b border-zinc-200 px-5 py-3 text-sm font-semibold">
                      {category.label}{" "}
                      <span className="font-normal text-zinc-500">({category.brands.length})</span>
                    </h3>
                    <ul className="divide-y divide-zinc-100">
                      {brands.map((brand) => {
                        const key = `${category.id}:${brand.entityId}`;
                        const open = pitchFor === key;
                        const sheetOpen = onePagerFor === key;
                        const allowed = brandAllowed(brand);
                        return (
                          <li key={brand.entityId} className="px-5 py-3">
                            <div className="flex items-start gap-3">
                              <span
                                className="mt-0.5 w-10 shrink-0 rounded-md bg-zinc-900 py-1 text-center text-sm font-semibold tabular-nums text-white"
                                title="Sponsor Fit Score, 0 to 100"
                              >
                                {brand.fitScore}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">{brand.name}</p>
                                <p className="mt-0.5 text-sm text-zinc-600">{brand.reasonText}</p>
                                {!allowed && (
                                  <p className="mt-1 text-xs text-zinc-500">
                                    Alcohol brands need a 21+ event. Search again as 21+.
                                  </p>
                                )}
                              </div>
                              <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                                <button
                                  type="button"
                                  onClick={() => draftPitch(key, brand, category.label)}
                                  disabled={!allowed || (pitchLoading && open)}
                                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-50"
                                >
                                  {pitchLoading && open ? "Writing…" : "Draft pitch"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setOnePagerFor(sheetOpen ? null : key)}
                                  disabled={!allowed}
                                  aria-expanded={sheetOpen}
                                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-50"
                                >
                                  Download one-pager
                                </button>
                              </div>
                            </div>

                            {sheetOpen && allowed && searchFacts && (
                              <OnePagerPanel
                                brand={brand}
                                category={category}
                                categories={result.categories}
                                search={searchFacts}
                                details={onePagerDetails}
                                onDetailsChange={setOnePagerDetails}
                              />
                            )}

                            {open && pitchError && (
                              <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                                {pitchError}
                              </p>
                            )}

                            {open && pitch && (
                              <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs text-zinc-500">
                                    {pitch.source === "deepseek" ? "Written by DeepSeek" : "Template draft"}
                                    {" · edit the parts in [brackets] before sending"}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={copyPitch}
                                    className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-zinc-100"
                                  >
                                    {copied ? "Copied" : "Copy email"}
                                  </button>
                                </div>
                                <p className="mt-3 text-sm font-semibold">{pitch.subject}</p>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-800">{pitch.body}</p>
                                {pitch.note && <p className="mt-3 text-xs text-zinc-500">{pitch.note}</p>}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    {category.brands.length > TOP_PER_CATEGORY && (
                      <button
                        type="button"
                        onClick={() => setExpanded({ ...expanded, [category.id]: !showAll })}
                        className="w-full border-t border-zinc-200 px-5 py-2.5 text-left text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                      >
                        {showAll ? "Show fewer" : `Show all ${category.brands.length}`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {result.input.city ? (
              <LocalSponsors
                key={searchId}
                artists={result.artists}
                genreTags={result.genreTags}
                city={result.input.city}
                age={result.input.age}
                admission={result.input.admission}
              />
            ) : (
              <p className="mt-5 rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm text-zinc-600">
                Add a city to see local sponsors on a map.
              </p>
            )}

            <details className="mt-6 rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm">
              <summary className="cursor-pointer font-medium">How the agent got this</summary>
              <ul className="mt-3 space-y-1.5 text-zinc-600">
                {result.calls.map((call) => (
                  <li key={call.label} className="flex flex-wrap justify-between gap-x-4">
                    <span>
                      Qloo <code className="text-xs">{call.endpoint}</code> · {call.label}
                    </span>
                    <span className="tabular-nums">
                      {call.error ? "failed" : `${call.resultCount} brands`} · {(call.ms / 1000).toFixed(1)} s
                      {call.retries > 0 ? ` · retried ${call.retries}x` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-zinc-500">
                The Sponsor Fit Score is our own 0 to 100 score. It comes from where a brand ranks in
                Qloo&rsquo;s taste data for this crowd and how evenly the line-up supports it.
              </p>
              {result.input.alcoholBlocked && (
                <p className="mt-2 text-xs text-zinc-500">
                  Beer, wine and spirits brands are left out because this is not a 21+ event.
                </p>
              )}
            </details>
          </section>
        )}
      </main>
    </div>
  );
}
