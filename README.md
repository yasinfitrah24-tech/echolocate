# Echolocate

**Sponsors for events too small to have a sponsorship team.**

Echolocate finds sponsors for small events (campus shows, community gigs) by asking Qloo which brands and local businesses the event's crowd already likes, then drafts the pitch email and a one-page sponsor sheet.

**Live demo:** https://echolocate-topaz.vercel.app/

Click **Try an example** for an instant result from saved real Qloo data.

![Results for the example event: brands ranked by category, each with a Sponsor Fit Score and the reason from Qloo's data](docs/screenshot-results.png)

![A one-page sponsor sheet for Guayakí, made in the browser. Unknown details are left in square brackets](docs/screenshot-one-pager.png)

Built for the Qloo Agentic Hackathon.

## What it does

The organizer enters the kind of music (or artists on the line-up), the city, who mostly comes, who is allowed in (all ages, 18+ or 21+) and the expected crowd. Echolocate then:

1. ranks brands per category for that crowd, each with a Sponsor Fit Score and a plain reason,
2. shows local cafes, clothing stores and (for 21+ events) bars on a map,
3. drafts a pitch email for any brand or local place,
4. makes a one-page sponsor PDF in the browser.

## How the agent works

Every Qloo call is listed in the app under "How the agent got this", with its result count.

1. **Genre.** A genre picked from the list already has its Qloo tag id (`src/data/music-genres.json`), so no call is needed. A typed genre is looked up with `GET /v2/tags` (`filter.query`), and the app says which Qloo genre it matched.
2. **Artists (optional).** Each name goes to `GET /search` (`query`, `types=urn:entity:artist`). Only an exact name match is used. Otherwise the app asks the organizer to pick the right artist, because a search for "Wishy" can return "Wish You Were Here".
3. **Brands.** `GET /v2/insights` with:
   - `filter.type=urn:entity:brand`
   - `signal.interests.entities` (artist ids) and `signal.interests.tags` (genre tag)
   - `signal.location.query` (the city) and `signal.demographics.age`
   - `feature.explainability=true`

   One call returns the top 50 brands across all categories. One call per sponsor category adds `filter.tags`: drinks and financial services, plus beer and spirits for 21+ events only. If a city returns nothing at all, the calls run again without the city, and the app says so.
4. **Rules, applied on the server.**
   - Alcohol brands (any `wine_and_spirits` tag) and bars only for 21+ events.
   - Advocacy groups that come back as "brands" are dropped.
   - Qloo's audience segments (`urn:audience`) are never used or shown.
5. **Score and reason.** The Sponsor Fit Score is our own score, not a Qloo number:
   - 80% Qloo's affinity for the brand, on a fixed scale,
   - 20% the brand's rank in its list,
   - capped at 95.

   Brands share one scale, so different categories can be compared. Local places have their own scale, because their affinity runs lower. The reason starts from the rank. It names an artist only when that artist's share of Qloo's explainability is clearly higher than the others'.
6. **Local places.** `GET /v2/insights` with:
   - `filter.type=urn:entity:place`
   - `filter.tags` (cafe, clothing store, bar)
   - the same signals as for brands
   - `filter.location=POINT(lon lat)` and `filter.location.radius` for a US city picked from the list. The radius is 5, 10 or 15 km by the city's population. With fewer than 6 places, the search runs once more with twice the radius (at most 30 km).

   A city typed by hand uses `filter.location.query` instead.
7. **Pitch email.** The language model (DeepSeek) writes the email from a fixed list of facts: the brand, the rank and reason from Qloo, and the event details. Anything it does not know stays in [square brackets]. Without a DeepSeek key, a built-in template writes it, and the app says which one was used.
8. **One-pager.** Built in the browser with `@react-pdf/renderer` from the same facts. Optional details the organizer adds (date, venue, tiers, discount code) fill the brackets. Items under "Confirmed so far" appear only when the organizer ticks them as confirmed.

## Why Qloo, not just a language model

Qloo picks the sponsors: which brands and local places, in what order, and why. The language model only writes the email from the facts it is given, and it may not add numbers, prices, dates or sponsors of its own. Without Qloo there is no list and nothing to pitch.

We have not yet compared Qloo with a language model picking brands on its own, so we make no claim about which is better.

## What we tested

**Backtest on 10 US festivals** (`backtest/results.md`). For each real sponsor found in Qloo, we checked its rank in Qloo's list for that festival's headliners and city.
- At the product-category level (the level the app uses), 25% of 129 sponsors were in the top 10, against 17% for a control: the same brands at festivals they did not sponsor.
- At the broad-category level it was 13% against 7%.
- The edge was small. At Bonnaroo we found 0 of 12 sponsors in the top 10.
- These were large festivals; small events have no public sponsor lists to test against.

**Probes of the Qloo API** (`scripts/probe-*.mjs`):
- **Places.** `filter.location=POINT(lon lat)` with a radius worked in our tests: with a 3 km radius, every cafe came back within 2.7 km. With a city name, the radius was ignored.
- **Brands.** A location given as a point barely changed the results in our tests. The top five were almost the same as with no location at all. So brands use the city name.
- **Cities without data.** Some cities return no brands at all, with no error. Indio, CA returned 0. The app then matches on the line-up alone and says so.
- **Score scales.** We set the scales from the saved example (indie, Austin) and a live country search (Nashville). Brand scores had a median of 70 in both.

## Limitations

- **Cities without Qloo data** get brands matched to the line-up alone.
- **Small local artists** are often not in Qloo. The genre field covers them, and artist names are optional.
- **City suggestions** cover US places from Census data (5,000+ people, plus small campus towns). Other cities can be typed, but brands then use the plain city name and places use the old city-name search.
- **The Sponsor Fit Score is ours.** It was calibrated on two searches, so other music or cities may sit higher or lower on the scale.
- **The PDF uses the built-in Helvetica font.** Accents outside Western European letters are dropped ("Allē" prints as "Alle"), and non-Latin scripts are not supported.
- **The demo's limits are kept in memory**, per server instance. They are not exact across a whole deployment.
- **The saved example is a snapshot** from 16 Oct 2026. Live searches use current data.

## Run it locally

Needs Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

- **Without any keys:** "Try an example" works (saved data), and pitches use the template.
- **With keys:** copy `.env.example` to `.env.local` and fill in:
  - `QLOO_API_KEY` for live searches,
  - `DEEPSEEK_API_KEY` (optional) for written pitches. `DEEPSEEK_MODEL` defaults to `deepseek-flash`.

`npm run lint` checks the code. `npx tsc --noEmit` checks types.

### Limits on the public demo

So that one visitor cannot use up the Qloo quota:
- 6 live searches per IP per 10 minutes, and 20 per day,
- 600 live Qloo calls per day in total,
- the saved example never counts.

**To pause all live searches** (the example keeps working), set the environment variable `QLOO_LIVE=off`:
- **Vercel:** Project → Settings → Environment Variables, add `QLOO_LIVE` = `off`, then redeploy. Remove it and redeploy to switch live search back on.
- **Locally:** add `QLOO_LIVE=off` to `.env.local` and restart `npm run dev`.

### Re-recording the saved example

"Try an example" is answered from saved real Qloo responses in `src/data/demo/qloo-recording.json`, so it is instant and makes no Qloo calls. Only the fields the app reads are kept. To record it again (about 8 Qloo calls), on Windows PowerShell:

1. Stop the dev server, then start it in record mode:
   `$env:QLOO_RECORD="1"; npm run dev`
2. In a second terminal, from the project root:
   `node scripts/record-demo.mjs`
3. Stop the dev server. **Then close that terminal, or run `Remove-Item Env:QLOO_RECORD`.** The variable stays set in that terminal, and while it is set every search runs live and is recorded.
4. Start the dev server normally (`npm run dev`) and check that "Try an example" shows "Saved example".

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Leaflet with OpenStreetMap tiles, `@react-pdf/renderer`. Deployed on Vercel. City data: US Census Bureau (public domain).

## License

MIT. See [LICENSE](LICENSE).
