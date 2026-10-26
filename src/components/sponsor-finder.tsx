"use client";

// The page under the header: hero and how it works, the event form, then the
// results (brands by category, local sponsors, pitch drafts, one-pagers and
// the Qloo call log).

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ADMISSIONS, AUDIENCE_AGES, DEFAULT_ADMISSION, findAdmission, findAudienceAge } from "@/lib/audience";
import {
  EMPTY_DETAILS,
  buildOnePager,
  onePagerAllowed,
  type OnePagerDetails,
  type SearchFacts,
} from "@/lib/one-pager";
import type { ArtistMatch, Brand, BrandCategory, QlooCall } from "@/lib/qloo";
import { findGenreByLabel } from "@/lib/genres";
import { AGENT_DETAILS_ID, AgentPanel } from "./agent-panel";
import { ScoreBadge, SourceTag } from "./badges";
import { CityCombobox } from "./city-combobox";
import { GenreCombobox } from "./genre-combobox";
import { Hero, HowItWorks } from "./intro";
import { LocalSponsors, type PlacesSearchInfo } from "./local-sponsors";
import { PitchBox, usePitch, type PitchContext } from "./pitch-draft";
import { OnePagerPanel } from "./one-pager-panel";
import {
  cardClass,
  cardTitleClass,
  errorNoticeClass,
  eyebrowClass,
  ghostButton,
  inputClass,
  labelClass,
  linkClass,
  noticeClass,
  primaryButton,
  warnNoticeClass,
} from "./styles";

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
  genreMatch: { query: string; tag: { id: string; name: string } | null } | null;
  unresolved: { query: string; candidates: ArtistMatch[] }[];
  categories: BrandCategory[];
  calls: QlooCall[];
  /** When the saved example was recorded; null for a live search. */
  savedExample: string | null;
  tookMs: number;
}

/** What the live search is doing right now, as the server reports it. */
type SearchStep = "artists" | "genre" | "brands" | "brands-without-city";

const STEP_TEXT: Record<SearchStep, string> = {
  artists: "Matching artists in Qloo…",
  genre: "Finding the genre in Qloo…",
  brands: "Ranking brands for this crowd…",
  "brands-without-city": "No taste data for this city. Ranking brands for the line-up alone…",
};

/** Scrolls a section into view; instant when the user prefers reduced motion. */
function scrollToId(id: string) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

/** Opens "How the agent got this" and brings it into view. */
function openAgentDetails() {
  const details = document.getElementById(AGENT_DETAILS_ID);
  if (details instanceof HTMLDetailsElement) details.open = true;
  scrollToId("agent");
}

/** "Oct 17" from an ISO date. */
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "A, B and C". */
function joinNames(names: string[]): string {
  return names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
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

const EXAMPLE_NOTE = `Instant: a saved search with real Qloo data, for ${
  findAdmission(EXAMPLE.admission)?.phrase ?? "a show"
} in ${EXAMPLE.city} with ${joinNames(splitNames(EXAMPLE.artistsText))}.`;

const TOP_PER_CATEGORY = 5;

/** At or below this expected crowd, local sponsors are shown above the brands. */
const SMALL_CROWD = 200;

function splitNames(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

interface SearchForm {
  genre: string;
  city: string;
  age: string;
  admission: string;
  crowdSize: string;
  includeAlcohol: boolean;
}

/** The form fields that change the brands, as one comparable string. */
function searchKey(form: {
  names: string[];
  confirmed: ConfirmedArtist[];
  genre: string;
  city: string;
  age: string;
  admission: string;
}): string {
  const lineUp = [...form.names, ...form.confirmed.map((artist) => artist.name)]
    .map((name) => name.toLowerCase())
    .sort();
  return JSON.stringify([
    lineUp,
    form.genre.trim().toLowerCase(),
    form.city.trim().toLowerCase(),
    form.age,
    form.admission,
  ]);
}

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
  const [step, setStep] = useState<SearchStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BrandsResponse | null>(null);
  // Changes with every successful search, so the local sponsors map reloads.
  const [searchId, setSearchId] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Place searches for the current result, shown under "How the agent got this".
  const [placesInfo, setPlacesInfo] = useState<PlacesSearchInfo | null>(null);
  // The form as it was for the last successful search.
  const [searchedKey, setSearchedKey] = useState<string | null>(null);
  // The crowd size when the search ran, so typing in the field does not move sections around.
  const [searchedCrowd, setSearchedCrowd] = useState<number | null>(null);

  const pitch = usePitch();

  // The results start below the form, out of view on most screens: bring them
  // into view after each successful search, so a click visibly does something.
  const resultsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (searchId === 0) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultsRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }, [searchId]);

  const [onePagerFor, setOnePagerFor] = useState<string | null>(null);
  // Kept across brands, so the organizer types their details once.
  const [onePagerDetails, setOnePagerDetails] = useState<OnePagerDetails>(EMPTY_DETAILS);

  const alcoholBlocked = !(findAdmission(admission) ?? DEFAULT_ADMISSION).alcoholAllowed;
  const includeAlcohol = !alcoholBlocked && wantsAlcohol;

  /** The form fields a search reads, as they are now. */
  function currentForm(): SearchForm {
    return { genre, city, age, admission, crowdSize, includeAlcohol };
  }

  // The form is passed in, not read from state: "Try an example" sets the
  // fields and searches in the same click, before React has re-rendered.
  async function findBrands(names: string[], confirmed: ConfirmedArtist[], form: SearchForm = currentForm()) {
    const { genre, city, age, admission, crowdSize, includeAlcohol } = form;
    const key = searchKey({ names, confirmed, genre, city, age, admission });
    const pickedGenre = findGenreByLabel(genre);
    setLoading(true);
    setStep(null);
    setError(null);
    pitch.reset();
    setOnePagerFor(null);
    try {
      const response = await fetch("/api/brands", {
        method: "POST",
        // Ask for a stream of steps, so the page shows which Qloo calls are running.
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        body: JSON.stringify({
          artistNames: names,
          artists: confirmed,
          // A genre from our list goes by its Qloo tag id; anything else is looked up.
          genreTagId: pickedGenre?.tagId,
          genre: pickedGenre ? undefined : genre.trim() || undefined,
          city: city.trim() || undefined,
          age: age || undefined,
          admission,
          includeAlcohol,
        }),
      });
      const outcome = await readSearch(response, setStep);
      if (!outcome.ok) {
        setResult(null);
        setError(outcome.error);
        return;
      }
      setResult(outcome.data);
      setPlacesInfo(null);
      setSearchedKey(key);
      setSearchedCrowd(crowdSize.trim() ? Number(crowdSize) : null);
      setSearchId((id) => id + 1);
      setExpanded({});
    } catch {
      setResult(null);
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
      setStep(null);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const names = splitNames(artistsText);
    if (names.length === 0 && picked.length === 0 && !genre.trim()) {
      setError("Pick a kind of music, or add an artist.");
      return;
    }
    void findBrands(names, picked);
  }

  /** Fills the form with the saved example and runs it (answered from the recording, no live Qloo call). */
  function runExample() {
    setEventName(EXAMPLE.eventName);
    setArtistsText(EXAMPLE.artistsText);
    setPicked([]);
    setGenre("");
    setCity(EXAMPLE.city);
    setAge(EXAMPLE.age);
    setCrowdSize(EXAMPLE.crowdSize);
    setAdmission(EXAMPLE.admission);
    setWantsAlcohol(true);
    const exampleAdmission = findAdmission(EXAMPLE.admission) ?? DEFAULT_ADMISSION;
    void findBrands(splitNames(EXAMPLE.artistsText), [], {
      genre: "",
      city: EXAMPLE.city,
      age: EXAMPLE.age,
      admission: EXAMPLE.admission,
      crowdSize: EXAMPLE.crowdSize,
      includeAlcohol: exampleAdmission.alcoholAllowed,
    });
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

  // City, age, admission and genre come from the search the list was found
  // with (checked by the server), not from the form as it is now.
  const pitchContext: PitchContext | null = result
    ? {
        artists: result.artists.map((artist) => artist.name),
        event: {
          name: eventName.trim() || undefined,
          city: result.input.city ?? undefined,
          crowdSize: crowdSize.trim() || undefined,
          age: result.input.age ?? undefined,
          admission: result.input.admission,
          genre: result.input.genre ?? undefined,
        },
      }
    : null;

  /** Alcohol brands need a 21+ event, both in the search and in the form as it is now. */
  function brandAllowed(brand: Brand): boolean {
    return (
      result !== null && onePagerAllowed(brand, result.input.admission) && onePagerAllowed(brand, admission)
    );
  }

  const formChanged =
    result !== null &&
    searchedKey !== searchKey({ names: splitNames(artistsText), confirmed: picked, genre, city, age, admission });

  const brandCount = result?.categories.reduce((sum, category) => sum + category.brands.length, 0) ?? 0;
  // The best score of the whole search gets a spot line on its badge.
  const topScore = result ? Math.max(0, ...result.categories.flatMap((category) => category.brands.map((brand) => brand.fitScore))) : 0;

  /** The poster header: who the crowd are fans of, then the event facts. */
  const lineUp = result
    ? [...result.artists.map((artist) => artist.name), ...result.genreTags.map((tag) => tag.name)]
    : [];
  const ageLabel = findAudienceAge(result?.input.age)?.label;
  const eventFacts = result
    ? [
        result.input.city,
        searchedCrowd ? `About ${searchedCrowd.toLocaleString("en-US")} people` : null,
        ageLabel ? `Mostly ${ageLabel}` : null,
        findAdmission(result.input.admission)?.label ?? null,
      ].filter((fact): fact is string => Boolean(fact))
    : [];

  // Small events: local businesses are the likelier sponsors, so they go first.
  const localFirst = searchedCrowd !== null && searchedCrowd > 0 && searchedCrowd <= SMALL_CROWD;
  const localSection = !result ? null : result.input.city ? (
    <LocalSponsors
      key={searchId}
      artists={result.artists}
      genreTags={result.genreTags}
      city={result.input.city}
      age={result.input.age}
      admission={result.input.admission}
      onLoaded={setPlacesInfo}
      pitchContext={pitchContext}
      barsAllowed={(findAdmission(admission) ?? DEFAULT_ADMISSION).alcoholAllowed}
      onePager={
        searchFacts ? { search: searchFacts, details: onePagerDetails, onDetailsChange: setOnePagerDetails } : null
      }
    />
  ) : (
    <p className={`mt-8 ${noticeClass}`}>Add a city to see local sponsors on a map.</p>
  );

  return (
    <main className="flex-1">
      <Hero onTryExample={runExample} busy={loading} exampleNote={EXAMPLE_NOTE} />
      <HowItWorks />

      <section id="your-event" className="scroll-mt-4">
        <div className="mx-auto grid max-w-[1120px] gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12">
          <div>
            <h2 className="font-display text-[30px] sm:text-[40px]">Your event</h2>
            <p className="mt-3 text-ink-2">
              Start with the kind of music or a few artists. Add a city to see local sponsors on a map.
            </p>
            <p className="mt-3 text-sm text-ink-2">
              No event yet?{" "}
              <button type="button" onClick={runExample} disabled={loading} className={`${linkClass} disabled:opacity-60`}>
                Try an example
              </button>
            </p>
          </div>

          <div>
            <form onSubmit={onSubmit} className={`${cardClass} p-5 sm:p-6`}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="genre" className={labelClass}>
                    What kind of music?
                  </label>
                  <GenreCombobox id="genre" className={inputClass} value={genre} onChange={setGenre} />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="artists" className={labelClass}>
                    Artists on your line-up, or artists they sound like{" "}
                    <span className="font-normal text-ink-2">(optional)</span>
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
                          className="flex items-center gap-1 rounded-chip bg-ink py-1 pr-1 pl-2.5 text-xs font-semibold text-white"
                        >
                          {artist.name}
                          <button
                            type="button"
                            onClick={() => removePicked(artist.entityId)}
                            aria-label={`Remove ${artist.name}`}
                            className="rounded-chip px-1.5 text-white/70 hover:text-white"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
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
                  <CityCombobox id="city" className={inputClass} value={city} onChange={setCity} />
                </div>

                <div>
                  <label htmlFor="age" className={labelClass}>
                    Audience age
                  </label>
                  <select id="age" className={inputClass} value={age} onChange={(event) => setAge(event.target.value)}>
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
                className={`mt-5 flex items-center gap-2 text-sm ${alcoholBlocked ? "text-ink-3" : "text-ink"}`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-spot"
                  checked={includeAlcohol}
                  disabled={alcoholBlocked}
                  onChange={(event) => setWantsAlcohol(event.target.checked)}
                />
                Include alcohol brands (beer and spirits)
              </label>
              {alcoholBlocked && <p className="mt-1 text-xs text-ink-2">Alcohol brands only show for 21+ events.</p>}

              <button type="submit" disabled={loading} className={`${primaryButton} mt-6 w-full sm:w-auto`}>
                {loading ? "Finding sponsors…" : "Find sponsors"}
              </button>
              {loading && (
                <p role="status" className="mt-3 flex items-center gap-3 text-sm">
                  <span className="search-pulse" aria-hidden="true">
                    <span />
                    <span />
                  </span>
                  {step ? STEP_TEXT[step] : "Starting the search…"}
                </p>
              )}
            </form>

            {error && (
              <p role="alert" className={`mt-4 ${errorNoticeClass}`}>
                {error}
              </p>
            )}
          </div>
        </div>
      </section>

      {result && (
        <section ref={resultsRef} id="results" className="scroll-mt-4 border-t border-line" aria-live="polite">
          <div className="mx-auto max-w-[1120px] px-4 py-12 sm:px-6">
            {searchFacts?.eventName && <p className={eyebrowClass}>{searchFacts.eventName}</p>}
            {lineUp.length > 0 && (
              <h2 className="mt-1">
                <span className="block text-[13px] font-bold tracking-[0.12em] text-ink-2 uppercase">For fans of</span>
                <span className="font-display mt-1.5 block text-[30px] uppercase sm:text-[44px]">
                  {lineUp.join(" · ")}
                </span>
              </h2>
            )}
            {eventFacts.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Event">
                {eventFacts.map((fact) => (
                  <li key={fact} className="rounded-chip border border-field bg-card px-2.5 py-0.5 text-[13px] font-medium">
                    {fact}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2 text-sm">
              {result.savedExample ? (
                <SourceTag tone="saved">
                  Saved example · instant. Real Qloo data from {shortDate(result.savedExample)}. Change anything to
                  run it live.
                </SourceTag>
              ) : (
                <SourceTag tone="live">Live Qloo data · found in {(result.tookMs / 1000).toFixed(1)} s</SourceTag>
              )}
              {/* Shortcuts to the parts at the bottom of a long page. */}
              {!localFirst && result.input.city && (
                <a
                  href="#local-sponsors"
                  onClick={(event) => {
                    event.preventDefault();
                    scrollToId("local-sponsors");
                  }}
                  className={linkClass}
                >
                  See local sponsors in {result.input.city}
                </a>
              )}
              <a
                href={`#${AGENT_DETAILS_ID}`}
                onClick={(event) => {
                  event.preventDefault();
                  openAgentDetails();
                }}
                className={linkClass}
              >
                How the agent got this
              </a>
            </div>

            {brandCount > 0 && (
              <p className="mt-3 max-w-[52em] text-[13px] text-ink-2">
                {brandCount} brands in {result.categories.length} categories. Sponsor Fit Score is our own score, not
                a Qloo number. It compares each brand with the others for the same crowd, so it only means something
                inside one search. It never goes above 95.
              </p>
            )}

            {formChanged && (
              <div className={`mt-5 flex flex-wrap items-center justify-between gap-3 ${warnNoticeClass}`}>
                <p>
                  You changed the event since this search. Search again to update the brands, pitch and one-pager.
                </p>
                <button
                  type="button"
                  onClick={() => void findBrands(splitNames(artistsText), picked)}
                  disabled={loading}
                  className={`${ghostButton} shrink-0`}
                >
                  {loading ? "Searching…" : "Search again"}
                </button>
              </div>
            )}

            {result.genreMatch && (
              <p className={`mt-5 ${noticeClass}`}>
                {result.genreMatch.tag ? (
                  <>
                    We matched &ldquo;{result.genreMatch.query}&rdquo; to Qloo&rsquo;s &ldquo;
                    {result.genreMatch.tag.name}&rdquo; genre.
                  </>
                ) : (
                  <>
                    We could not find &ldquo;{result.genreMatch.query}&rdquo; in Qloo&rsquo;s genres, so it was left
                    out. Try one from the list.
                  </>
                )}
              </p>
            )}

            {result.input.cityDropped && (
              <p className={`mt-5 ${warnNoticeClass}`}>
                Qloo has no taste data for &ldquo;{result.input.city}&rdquo;, so these brands are matched to the
                line-up alone. Try the nearest larger city to bring in local favourites.
              </p>
            )}

            {brandCount === 0 && (
              <p className={`mt-5 ${noticeClass}`}>
                {result.artists.length === 0
                  ? `Qloo found no brands for this genre${result.input.city ? ` in ${result.input.city}` : ""}. Try a different genre or add artists.`
                  : "Qloo returned no brands for this line-up. Check the artist names, or add a genre."}
              </p>
            )}

            {result.unresolved.map((item) => (
              <div key={item.query} className={`mt-5 ${warnNoticeClass}`}>
                {item.candidates.length === 0 ? (
                  <p>
                    We could not find &ldquo;{item.query}&rdquo; in Qloo, so it was left out. Adding a genre helps
                    cover it.
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
                          className={ghostButton}
                        >
                          {candidate.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}

            {localFirst && (
              <>
                <p className="mt-8 font-semibold">
                  For a crowd this size, local businesses are the likeliest yes. National brands are below.
                </p>
                {localSection}
              </>
            )}

            <div className="mt-8 grid items-start gap-5 lg:grid-cols-2">
              {result.categories.map((category) => {
                const showAll = expanded[category.id] ?? false;
                const brands = showAll ? category.brands : category.brands.slice(0, TOP_PER_CATEGORY);
                return (
                  <div key={category.id} className={cardClass}>
                    <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
                      <h3 className={cardTitleClass}>{category.label}</h3>
                      <span className="text-[13px] text-ink-2">
                        {category.brands.length} {category.brands.length === 1 ? "brand" : "brands"}
                      </span>
                    </div>
                    <ul>
                      {brands.map((brand) => {
                        const key = `${category.id}:${brand.entityId}`;
                        const open = pitch.pitchFor === key;
                        const sheetOpen = onePagerFor === key;
                        const allowed = brandAllowed(brand);
                        return (
                          <li key={brand.entityId} className="border-t border-line px-4 py-3.5 first:border-t-0 sm:px-5">
                            <div className="flex gap-3">
                              <ScoreBadge score={brand.fitScore} top={brand.fitScore === topScore} />
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold">{brand.name}</p>
                                <p className="mt-0.5 text-sm text-ink-2">{brand.reasonText}</p>
                                {!allowed && (
                                  <p className="mt-1 text-xs text-ink-2">
                                    Alcohol brands need a 21+ event. Search again as 21+.
                                  </p>
                                )}
                                <div className="mt-2.5 flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      pitchContext &&
                                      pitch.draft(
                                        key,
                                        {
                                          name: brand.name,
                                          categoryLabel: category.label,
                                          reasonText: brand.reasonText,
                                          kind: "brand",
                                        },
                                        pitchContext,
                                      )
                                    }
                                    disabled={!allowed || pitch.isWriting(key)}
                                    className={ghostButton}
                                  >
                                    {pitch.isWriting(key) ? "Writing…" : "Draft pitch"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setOnePagerFor(sheetOpen ? null : key)}
                                    disabled={!allowed}
                                    aria-expanded={sheetOpen}
                                    className={ghostButton}
                                  >
                                    Make one-pager
                                  </button>
                                </div>
                              </div>
                            </div>

                            {sheetOpen && allowed && searchFacts && (
                              <OnePagerPanel
                                kind="brand"
                                name={brand.name}
                                sponsorNoun={category.label.toLowerCase()}
                                eventName={searchFacts.eventName}
                                build={(details) =>
                                  buildOnePager(brand, category, result.categories, searchFacts, details)
                                }
                                blockedText="Alcohol brands need a 21+ event. Search again as 21+."
                                details={onePagerDetails}
                                onDetailsChange={setOnePagerDetails}
                              />
                            )}

                            {open && (
                              <PitchBox pitch={pitch.pitch} error={pitch.error} copied={pitch.copied} onCopy={pitch.copy} />
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    {category.brands.length > TOP_PER_CATEGORY && (
                      <button
                        type="button"
                        onClick={() => setExpanded({ ...expanded, [category.id]: !showAll })}
                        className="w-full border-t border-line px-4 py-2.5 text-left text-xs font-semibold text-ink-2 hover:bg-paper hover:text-ink sm:px-5"
                      >
                        {showAll ? "Show fewer" : `Show all ${category.brands.length}`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {!localFirst && (
              <div id="local-sponsors" className="scroll-mt-4">
                {localSection}
              </div>
            )}

            <AgentPanel
              calls={result.calls}
              places={placesInfo}
              brandCount={brandCount}
              savedExample={result.savedExample !== null}
              alcoholBlocked={result.input.alcoholBlocked}
            />
          </div>
        </section>
      )}
    </main>
  );
}

type SearchOutcome = { ok: true; data: BrandsResponse } | { ok: false; error: string };

const SEARCH_FAILED = "Something went wrong. Try again, or use Try an example.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Checks the parts of the /api/brands answer the page reads before using it. */
function isBrandsResponse(value: unknown): value is BrandsResponse {
  return (
    isRecord(value) &&
    isRecord(value.input) &&
    Array.isArray(value.artists) &&
    Array.isArray(value.genreTags) &&
    Array.isArray(value.unresolved) &&
    Array.isArray(value.categories) &&
    Array.isArray(value.calls)
  );
}

function toOutcome(ok: boolean, body: unknown): SearchOutcome {
  if (ok && isBrandsResponse(body)) return { ok: true, data: body };
  const error = isRecord(body) && typeof body.error === "string" ? body.error : SEARCH_FAILED;
  return { ok: false, error };
}

const STEPS = new Set<unknown>(Object.keys(STEP_TEXT));

function isStep(value: unknown): value is SearchStep {
  return STEPS.has(value);
}

/**
 * Reads /api/brands: a stream of {"step"} lines then {"done", "status",
 * "body"}, or plain JSON (limits and bad input are answered before any step).
 */
async function readSearch(response: Response, onStep: (step: SearchStep) => void): Promise<SearchOutcome> {
  if (!response.headers.get("content-type")?.includes("application/x-ndjson") || !response.body) {
    return toOutcome(response.ok, await response.json());
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const message: unknown = JSON.parse(line);
      if (!isRecord(message)) continue;
      if (isStep(message.step)) onStep(message.step);
      if (message.done === true) {
        const status = typeof message.status === "number" ? message.status : 500;
        return toOutcome(status >= 200 && status < 300, message.body);
      }
    }
    if (done) break;
  }
  return { ok: false, error: "The search stopped before it finished. Try again." };
}
