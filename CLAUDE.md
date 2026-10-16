# Echolocate

Sponsors for events too small to have a sponsorship team.

An AI agent for small event organizers (campus, community). The organizer enters a line-up (or a genre), city, audience age, admission (All ages / 18+ / 21+) and crowd size. Echolocate uses Qloo taste data to rank brands per category with a Sponsor Fit Score and a reason, shows local sponsors (cafes, clothing stores, bars) on a map, drafts the pitch email (for brands and local places), and makes a one-page sponsor PDF in the browser.

Built for the Qloo Agentic Hackathon (Devpost). Rule from the organizers: if the app works the same without Qloo, it is the wrong build. The LLM writes text; Qloo picks the sponsors.

@AGENTS.md

## Stack
- Next.js 16.4 (App Router, TypeScript, `src/`, `cacheComponents: true`), React 19.3, Tailwind 4. Read `node_modules/next/dist/docs/` before using Next APIs you are not sure about (see AGENTS.md).
- Leaflet + react-leaflet + OpenStreetMap tiles. Leaflet touches `window`, so `places-map.tsx` is only loaded with `next/dynamic` and `ssr: false`. Markers are `CircleMarker` (no icon images).
- DeepSeek for the pitch email (`src/lib/pitch.ts`): `https://api.deepseek.com/chat/completions`, model `deepseek-flash`, thinking off, JSON output. No key or an error → built-in template, and the response says which one was used.
- Deployed on Vercel; every push to `main` auto-deploys. Env vars are set in Vercel too.

## Commands (Windows, PowerShell, run from the repo root)
- `npm run dev` · `npm run build` · `npm run lint`
- Probe scripts call the real Qloo API: `node --env-file=.env.local scripts/try-qloo.mjs` (also `try-api.mjs`, `try-pitch.mjs`, `try-places.mjs`). `try-api.mjs` needs `npm run dev` running.
- Backtest (closed, do not change the method): `backtest/run.mjs` → `backtest/results.md`.
- `next build` loads Geist from Google Fonts; it can fail on networks that cannot reach Google. That is not a code bug.

## Layout
- `src/lib/qloo.ts` — Qloo client, server only (reads `QLOO_API_KEY`). `searchArtists`, `searchGenreTags`, `getSponsorBrands` (top-50 general list + drinks, beer, spirits, financial services), `getLocalSponsors` (places), fit score, reasons, call log.
- `src/lib/audience.ts` — audience age groups + admission. Safe to import from client components.
- `src/lib/pitch.ts` — pitch email (DeepSeek or template).
- Routes: `src/app/api/artists`, `brands`, `pitch`, `places` (all POST JSON except artists).
- UI: `src/components/sponsor-finder.tsx` (form, brands, pitch), `local-sponsors.tsx` (list + filters, fetches `/api/places`), `places-map.tsx` (Leaflet), `pitch-draft.tsx` (shared pitch box), `combobox.tsx` + `city-combobox.tsx` + `genre-combobox.tsx`, `one-pager-panel.tsx` + `one-pager-pdf.tsx` (PDF via `@react-pdf/renderer`, loaded with `import()`).
- `src/lib/one-pager.ts` (one-pager text), `genres.ts` (curated genres + Qloo tag ids, `src/data/music-genres.json`), `us-cities.ts` (server lookup in `public/data/us-cities.json`, Census data), `demo-recording.ts` (saved "Try an example" Qloo answers, `src/data/demo/qloo-recording.json`), `rate-limit.ts` (per-IP limits, 600 live calls/day, `QLOO_LIVE=off`).

## Qloo API — what we learned the hard way
- Base URL is only `https://hackathon.api.qloo.com`, header `X-Api-Key`. Do not use `/recs`.
- `GET /v2/insights` needs `filter.type`. Flow: `/search` or `/v2/tags` → entity/tag IDs → `/v2/insights`.
- **Unknown or wrong parameters are ignored silently.** A typo returns an unfiltered or empty list, not an error. Log every call (`calls`) with its result count.
- **A city Qloo has no data for returns 0 results, no error** (e.g. "Indio, CA"). The brands route retries with the line-up only and tells the user.
- A city can shrink category lists a lot (phones: 46 brands without a city, 3–5 with one). For general, drinks and financial services the counts stayed the same with and without a city (probe 16 Oct); only the order moved. Category queries keep the city.
- `filter.location.radius` is ignored when the location is a city name, but works with `filter.location=POINT(lon lat)` (3 km radius → every place within 2.7 km, probe 16 Oct). Places for a city picked from the US list use POINT + a radius from its population (< 50k → 5 km, ≤ 500k → 10 km, larger → 15 km); fewer than 6 places → one retry at 2x, max 30 km. A typed city not in the list falls back to the city name, the median of the results as center, and drops anything > 20 km. Coordinates are in `location.lat/lon`. `business_rating` comes as a long float → round it.
- For brands, `signal.location` as a POINT barely changed results (top 5 ≈ no location at all), so brands keep `signal.location.query` with the city name.
- Rate limit: bursts get 429. Code runs at most 3 calls at once and retries 429/503 with backoff; 2 at once is safer. There may be a monthly quota (another team's key had 10,000/month) → cache demo examples.
- Explainability shares add up to 1 and are nearly equal for similar line-ups, so reasons start from the rank and only name an artist when their share is clearly higher.
- Tag shapes differ: `/search` → `tags[].tag_id`, `/v2/insights` → `tags[].id`. Brand tags are layered: broad (`wine_and_spirits`), product (`wine_and_spirits:beer`), sub (`...:spirits:vodka`). Filter with broad or product level.
- Youngest age group is `24_and_younger`; there is no "21 and younger".
- Artist search can match the wrong name ("Wishy" → "Wish You Were Here"), so the UI asks the user to confirm when the name is not exact. Genre is the fallback.

## Product rules (do not break these)
- Audience age and admission are separate. **Alcohol brands (any `wine_and_spirits` tag) and bars only for 21+ events**, enforced in the server, not only the UI.
- Never show Qloo `urn:audience` segments (identity/political) anywhere.
- The pitch only uses facts it was given; unknowns go in [square brackets].
- Sponsor Fit Score, our own score (say so in the UI), capped at 95; never show raw affinity numbers.
  - Brands: relative to the other brands of the same search. score = 40 + 55 x (0.8 x affinity percentile among all brands of the search + 0.2 x rank in its list). A fixed affinity scale failed: genre signals push affinity to 0.97-1.00 and every genre search got 95s (stage 7, 18 Oct). A category's #1 brand under 80 gets a note that the category is a smaller fit.
  - Local places: same relative formula, over only the places with taste data; with fewer than 5 of those, a fixed scale instead (80% affinity 0.65-0.96 + 20% rank). Places at Qloo's default affinity (exactly 0.7649962877984056) or below get no score: "Nearby · little taste data", listed after scored places by distance. Their pitch talks about being nearby (distance from the search center), crowd and offer, and never claims the crowd likes them.
- Brand cards: Drinks, Beer, Spirits, Wine & spirits, Financial services, Dining, Fashion, Retail first (fixed order), then other categories by their best score, then Mobile app, Website, Entertainment, then Other. Ranks ("#3 of 38") are counted after all filters.
- Not sponsors, dropped in the server: NGO "brands", and brands tagged sports_organization, academic, cultural_arts or entertainment:media:news_and_politics.

## Rules for working in this repo
- API keys live only in `.env.local` (and Vercel). Never commit keys, never print them, never put them in this file or in chat. `.env.example` lists the names only.
- Upstream error text stays in server logs; the browser gets a short message.
- Keep changes small and runnable. After code changes run `npm run lint` and, if possible, `npx tsc --noEmit`.
- Write UI copy in plain English, short sentences.
- Deadline: Oct 31, 11:45 China time. Target submit: Oct 30.
