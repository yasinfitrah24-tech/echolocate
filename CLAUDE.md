# Echolocate

Sponsor finder for small events (tagline not final; see CLAUDE.local.md).

An AI agent for small event organizers (campus, community). The organizer enters a line-up (or a genre), city, audience age, admission (All ages / 18+ / 21+) and crowd size. Echolocate uses Qloo taste data to rank brands per category with a Sponsor Fit Score and a reason, shows local sponsors (cafes, clothing stores, bars) on a map, and drafts the pitch email. A one-page sponsor PDF is next.

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
- UI: `src/components/sponsor-finder.tsx` (form, brands, pitch), `local-sponsors.tsx` (list + filters, fetches `/api/places`), `places-map.tsx` (Leaflet).

## Qloo API — what we learned the hard way
- Base URL is only `https://hackathon.api.qloo.com`, header `X-Api-Key`. Do not use `/recs`.
- `GET /v2/insights` needs `filter.type`. Flow: `/search` or `/v2/tags` → entity/tag IDs → `/v2/insights`.
- **Unknown or wrong parameters are ignored silently.** A typo returns an unfiltered or empty list, not an error. Log every call (`calls`) with its result count.
- **A city Qloo has no data for returns 0 results, no error** (e.g. "Indio, CA"). The brands route retries with the line-up only and tells the user.
- A city also shrinks category lists a lot (phones: 46 brands without a city, 3–5 with one). Open question whether category queries should drop the city.
- `filter.location.radius` is ignored when the location is a city name. Places: we take the median of the results as the center and drop anything > 20 km away. Coordinates are in `location.lat/lon`. `business_rating` comes as a long float → round it.
- Rate limit: bursts get 429. Code runs at most 3 calls at once and retries 429/503 with backoff; 2 at once is safer. There may be a monthly quota (another team's key had 10,000/month) → cache demo examples.
- Explainability shares add up to 1 and are nearly equal for similar line-ups, so reasons start from the rank and only name an artist when their share is clearly higher.
- Tag shapes differ: `/search` → `tags[].tag_id`, `/v2/insights` → `tags[].id`. Brand tags are layered: broad (`wine_and_spirits`), product (`wine_and_spirits:beer`), sub (`...:spirits:vodka`). Filter with broad or product level.
- Youngest age group is `24_and_younger`; there is no "21 and younger".
- Artist search can match the wrong name ("Wishy" → "Wish You Were Here"), so the UI asks the user to confirm when the name is not exact. Genre is the fallback.

## Product rules (do not break these)
- Audience age and admission are separate. **Alcohol brands (any `wine_and_spirits` tag) and bars only for 21+ events**, enforced in the server, not only the UI.
- Drop NGO "brands" (`urn:tag:genre:brand:ngo...`, e.g. Black Lives Matter).
- Never show Qloo `urn:audience` segments (identity/political) anywhere.
- The pitch only uses facts it was given; unknowns go in [square brackets].
- Sponsor Fit Score = 80% Qloo affinity on a fixed scale (brands 0.80-0.975, local places 0.65-0.96) + 20% rank in the list it came from, capped at 95. Calibrated 16 Oct on indie Austin and country Nashville (`scripts/probe-score.mjs`). It is our own score; say so in the UI. A category's #1 brand under 80 gets a note that the category is a smaller fit; never show raw affinity numbers.

## Rules for working in this repo
- API keys live only in `.env.local` (and Vercel). Never commit keys, never print them, never put them in this file or in chat. `.env.example` lists the names only.
- Upstream error text stays in server logs; the browser gets a short message.
- Keep changes small and runnable. After code changes run `npm run lint` and, if possible, `npx tsc --noEmit`.
- Write UI copy in plain English, short sentences.
- Deadline: Oct 31, 11:45 China time. Target submit: Oct 30.
