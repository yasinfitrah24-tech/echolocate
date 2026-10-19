# Qloo vs a language model alone: test plan

Status: **approved, not run.** Written 19 Oct 2026 and approved by Yasin the same day with decisions A–D and three design changes (see "Decisions" and the change log at the bottom), all **before any model call and before any result was seen**. Nothing in this file may change after the first run starts, except to fix a typo; any other change is logged at the bottom with the date and the reason.

## Question

Judges will ask: "Does this still work without Qloo?" The Qloo backtest (`backtest/results.md`, run 10 Oct 2026) found that real festival sponsors land in Qloo's top 10 for their category **25% of the time, against 17% for the control** (product-level categories, 129 sponsor rows). This test asks the same question of the language model the app already uses, with no Qloo data: does it put the real sponsors in its top 10 more often than the control?

The model is `deepseek/deepseek-v4.1-flash` on OpenRouter, the same model and settings as the live pitch writer (`src/lib/pitch.ts`).

## 1. Data

Exactly the backtest's data, read from the backtest's own files. Nothing in `backtest/` is changed; the script only reads it.

- **Festivals:** the 10 festivals in `backtest/festivals.json` (230 sponsor rows, 180 unique sponsors).
- **Sponsor rows tested:** the **129 rows** the backtest tested at the product level, taken from `backtest/results.json` → `levels.product.rows` where `status = "tested"`. Each row already holds the festival, the sponsor name, the name Qloo matched (`qlooName`), and the product-level category tag. The 101 other rows are left out for the same reasons as in the backtest: 66 sponsors are not in Qloo, and 35 have no product-level tag.
- **Categories:** the backtest's **25 product-level tags**, the same tag per sponsor row:
  `automotive:car_and_suv, automotive:electric, electronics:computer_components, electronics:home_theater, electronics:phones_and_tablets, entertainment:media, fashion:accessories, fashion:athletic, fashion:casual, fashion:footwear, financial_services:credit_card, food_and_beverage:drinks, food_and_beverage:food, health_and_beauty:skincare, mobile_app:e_commerce, mobile_app:financial_services, mobile_app:food_and_dining, mobile_app:photo_and_video, mobile_app:social_networking, mobile_app:streaming_service, travel:airline, travel:hotel, wine_and_spirits:beer, wine_and_spirits:spirits, wine_and_spirits:wine`
- **Lists asked for:** one list per festival and category, the same 249 lists the backtest could use. The backtest had 25 × 10 = 250, but one list (`financial_services:credit_card` for one festival) was empty in Qloo and unusable, so the LLM is not asked for it either.
- **Broad level: not run (decision A).** The backtest also reports 16 broad tags, with 157 rows tested, 158 usable lists, and Qloo at **13% vs control 7%**. Running the LLM only at the product level was decided **before any result was seen**. The product level is the one the app uses, and the one behind the "25% vs 17%" number. The broad Qloo numbers stay in `backtest/results.md`, and no LLM comparison is claimed for them.

The backtest's own subsets are also reported for the LLM, on the same rows: "full lists only" (103 rows where Qloo's list had 50 brands; Qloo 21% vs 14%) and "exact name matches only" (92 rows; Qloo 27% vs 19%).

## 2. Input to the model

The model gets the same input Qloo got: the headliners and the city. It never gets the festival name or the year.

- **Line-up:** the headliners Qloo actually used. These are the names in `festivals.json`, minus the two the backtest could not find in Qloo (Justin Timberlake for BottleRock, Don Omar for Sueños), so those two festivals get two artists each, as Qloo did.
- **City:** the festival's city from `festivals.json`. For Coachella and Stagecoach (Indio, CA), Qloo had no data for the city and the backtest used the line-up alone, so the model also gets no city for those two.
- The order of the artists is as in `festivals.json`.

## 3. Prompts (sent exactly as written)

Settings for every call:

- `model: "deepseek/deepseek-v4.1-flash"`
- `temperature: 0.7` (same as the app)
- `reasoning: { effort: "none" }` (same as the app; 0 reasoning tokens in the 19 Oct pitch test)
- `max_tokens: 800`, so a list is not cut off.
- `provider: { order: ["digitalocean"], allow_fallbacks: false }`: every call goes to DigitalOcean, with no fallback to another provider (decision C). DigitalOcean served one of the 19 Oct pitch test calls.
- No `response_format`, the same as the app; the reply's outermost `{...}` is parsed.
- One user message per list. No conversation history between calls.

**Reading a reply:**

- A reply that was cut off (`finish_reason: "length"`), or whose JSON cannot be read, is retried once (section 8).
- When the model gives **more than 10 brands**, the first 10 are kept.
- **Duplicate names** are removed first; two names are duplicates when they are the same after the section 7 normalization. The first one is kept.
- **Fewer than 10** are used as they are.
- The **average number of brands per list** is reported.

### 3a. Brand list (one call per festival × category × run)

System message:

```
You know which brands different music audiences like. You answer with JSON only, no other text.
```

User message (`{line-up}` = artist names joined with ", "; the `City:` line is left out when there is no city; `{category}` = the readable label below):

```
Line-up of a live music event: {line-up}
City: {city}
Category: {category}

List the 10 brands in this category that people who come to see this line-up like most, best first. Only real brands. No explanations.

Return JSON in exactly this shape: {"brands": ["first brand", "second brand", "third brand", "fourth brand", "fifth brand", "sixth brand", "seventh brand", "eighth brand", "ninth brand", "tenth brand"]}
```

**Readable category label:** built mechanically from the tag, never by hand. Underscores become spaces, "and" stays as is, the first letter is capitalised, and the colon becomes " > ". Examples:

- `wine_and_spirits:spirits` → `Wine and spirits > spirits`
- `mobile_app:food_and_dining` → `Mobile app > food and dining`
- `fashion:casual` → `Fashion > casual`

The question mirrors what Qloo was asked: the brands this audience likes most in a category. The word "sponsor" is not in the prompt (decision B).

### 3b. Memorization check (one call per festival × run)

System message:

```
You answer with JSON only, no other text.
```

User message (same `{line-up}` and `City:` rule as above):

```
These are the headliners of a music festival in the United States: {line-up}
City: {city}

Which festival is this, and which year? If you are not sure, give your best guess.

Return JSON in exactly this shape: {"festival": "name of the festival", "year": 2024, "confidence": "high"}
Use "high", "medium" or "low" for confidence.
```

## 4. Metric

The same as the backtest's "Top 10" column at the product level:

- **Own festival:** a sponsor row is a **hit** when the sponsor appears in the model's top 10 for its own festival and its own category (section 7 says what counts as "appears").
- **Rate** = hits ÷ 129, as a percentage rounded to a whole number, the same as `pct()` in `backtest/run.mjs`.

A model list is always 10 long, while Qloo's lists were up to 50, so only the top-10 metric can be compared. Top 5 is reported too, from the order the model gives (1–10).

## 5. Control

The same control as the backtest:

- For each tested row, the same sponsor is looked up in the model's lists for the same category at **each other festival**.
- Festivals the sponsor also sponsored are skipped, using the same rule as `run.mjs`: the other festival lists the same Qloo entity.
- Lists the backtest could not use are skipped (the empty `credit_card` list).
- This gives the same **1,052 control look-ups** as the backtest, and control rate = control hits ÷ 1,052.

Result line, per run and averaged: **"LLM: A% vs control B%"**, shown next to **"Qloo: 25% vs control 17%"** (32/129 and 178/1052).

## 6. Memorization check

For each festival, the call in section 3b is made once per run, with the same settings as the lists (temperature 0.7): 3 runs × 10 festivals = 30 calls, so 3 guesses per festival (decision D).

- **Flagged ("memorized"):** a festival is flagged if at least 1 of its 3 guesses names the right festival. "Right" means the guess, normalized with the section 7 rules, contains the festival's core name: Coachella, Stagecoach, BottleRock, Sonic Temple, Boston Calling, Bonnaroo, Hangout, Sueños / Suenos, Ultra, Dreamville. The year does not have to be right.
- Every result is reported **twice**: with all 10 festivals, and with the flagged festivals left out, both in the own-festival rows and as control lists. Qloo's numbers are recomputed on the same subset from `backtest/results.json`, so both sides are compared on the same festivals.
- The 30 raw guesses are listed in `results.md`.

## 7. Name matching

There are no entity IDs for the model's answers, so matching is done on names.

**Normalization:** the same `tokens()` function as `backtest/run.mjs`:

1. Lowercase.
2. NFKD, with accents dropped.
3. `'`, `’` and `.` removed.
4. Every other run of non-letters or non-digits becomes one space.

One extra rule, applied the same way to both names: a leading word "the" is dropped.

**Automatic hit:** the normalized model answer is exactly equal to the normalized sponsor name from `festivals.json`, or to the `qlooName` the backtest matched for that row. The backtest gave Qloo credit for that entity, so the model gets the same credit.
- Example: sponsor "Dunkin'", Qloo name "Dunkin' Donuts". Both "Dunkin" and "Dunkin Donuts" are automatic hits.

**Only close look-alikes go on the manual list (`backtest-llm/manual-check.md`); they are not counted automatically.** A model answer that is not an automatic hit is a close look-alike of a sponsor when either of these holds against the sponsor name or the `qlooName`:

- **Shared word:** after normalization, they share at least one word of 3+ letters that is not on the fixed list of generic words below. Example: "Corona Seltzer" vs "Corona".
- **Small edit distance:** with spaces removed, both are at least 5 letters long, and the Levenshtein distance between them is **2 or less**. Example: "Heinekin" vs "Heineken".

Generic words (fixed now, the same list as in `run.mjs`): and, the, co, company, inc, group, brands, brand, usa, america, american, beer, brewing, brewery, wine, wines, cellars, vineyards, spirits, vodka, tequila, whiskey, whisky, rum, gin, seltzer, hard, water, drink, drinks, energy, coffee, app, bank, card, credit, airlines, airline, air, hotels, hotel, resorts, motors, auto, foods, food, beauty, skin, care, music, tv, plus, pay, light, ultra, zero, diet, classic, original, premium, lager, ale, ipa, club.

Without this list, "Bud Light" vs "Coors Light" or "American Express" vs "American Eagle" would flood the manual list. Any other answer, for example a parent company with no shared word ("Anheuser-Busch" for "Bud Light"), counts as a miss and is not listed.

**How the list is built:**

- Look-alikes are collected from every list a row is scored on: its own festival and its control festivals, in all 3 runs.
- There is one line per sponsor / answer pair, with where it was seen. Yasin's decision on a pair applies everywhere that pair appears.
- The file states how many lines it has.
- **If there are more than 150 lines, the file is not written.** The script reports the count first, and the file is written only after Yasin agrees (`--score --write-manual`).

Yasin marks each line "yes" (same brand) or "no".

**Rule set now:** a parent company is **not** the same as a child brand, and a child brand is not the same as its parent, unless one of them is the sponsor name or the `qlooName`.

Results are reported **automatic only**, and **automatic + manually approved**, in separate rows. The headline number is the automatic one.

## 8. Runs

- The full test is run **3 times**: 3 × 249 lists, plus the memorization calls.
- Each run is a fresh set of calls, with no cache between runs.
- For each metric (own top 10, control top 10, own top 5, the subsets, with and without flagged festivals), report the **mean of the 3 runs and the range (lowest – highest)**.
- Qloo's numbers come from one run. Qloo's API returns the same list for the same query, so it has no spread to report.

**Failed calls:** a call fails when it errors, is cut off (`finish_reason: "length"`), or returns JSON that cannot be read.

- A failed call is retried once, 2 s later. After a 429, the retry waits for `Retry-After`, at most 30 s.
- If it fails again, its list is counted as **empty** (all misses), not dropped.
- These lists are **reported separately in `results.md`**: how many, and which run, festival and category, with the error.

**Stop rule (decision C):** once at least 20 calls have finished, if more than **5%** of finished calls have failed twice, the script **stops and reports**. It never switches to another provider on its own. Whether and how to go on is Yasin's decision.

Failed calls are saved in `raw/` and are not made again when the script resumes, unless it is run with `--retry-failed`. Using that flag is reported in `results.md`.

## 9. Reporting rules (fixed before any result is seen)

1. **All results go into `backtest-llm/results.md` as they come out**, including runs that look bad for Qloo, failed calls, and the manual-check list with Yasin's decisions. Raw replies are kept (section 12).
2. **"LLM equal or better than Qloo"** means, at the product level, on all 10 festivals, automatic matching, mean of 3 runs:
   - the LLM's own top-10 rate is **≥ 25%**, **or**
   - the LLM's gap (own − control) is **≥ 8 points**, Qloo's gap.

   If either holds, **we do not use any Qloo-vs-LLM comparison claim** in the pitch, the video or Devpost. That decision is written in `results.md`.
3. **Claims for Devpost are chosen only after the results are in**, and only with Yasin's approval. Until then, the rule in `CLAUDE.local.md` stays: no "better than an LLM" claim.
4. If the comparison only holds without the flagged festivals, or only with manual matches, any claim must say so in the same sentence.
5. Only the product level is run (decision A, fixed before any result). No LLM claim is made about the broad level.

## 10. Calls and cost

**Calls** (product level only, decision A):

| | Calls |
|---|---|
| Brand lists: 25 categories × 10 festivals − 1 unusable = 249 lists × 3 runs | **747** |
| Memorization: 10 festivals × 3 runs | **30** |
| **Total** | **777** |

Retries (section 8) add at most one call per failed call.

**Price:** DigitalOcean only (decision C), **$0.195 input / $0.78 output per 1M tokens** (`/api/v1/models/deepseek/deepseek-v4.1-flash/endpoints`, read 19 Oct 2026). For reference, the same model cost $0.0472 / $0.12 at the cheapest provider and $0.60 / $2.40 at the most expensive one, but with the provider fixed those prices do not apply.

**Estimate**, at about 450 input and 150 output tokens per call (10 brand names in JSON):

| | Cost |
|---|---|
| Expected | **$0.16** |
| Worst: every reply uses all 800 `max_tokens` | **$0.55** |
| Worst, and every call retried once | **$1.11** |

**Cost brake:** the script adds up `usage.cost` from every reply, including earlier sessions read back from `raw/`. It starts no new call once the total reaches **$1.50**. Up to 2 calls already running can still finish, so the total can end a few cents over (about $0.02 in the brake test). It prints the real token counts and cost at the end, and `results.md` reports them.

The key's limit is $4, and the same key also pays for the live app's pitches.

## 11. Known limits

- **Memorization favors the model.** These are large, well-reported festivals, and the model may have read their sponsor lists. A headliner line-up plus a city can be enough to recall the festival, and then its sponsors. Section 6 catches the obvious cases but not all of them: a model can recall sponsors without naming the festival. Any advantage the model shows here may be partly recall, which does not exist for the small events Echolocate is for.
- **Qloo's categories may favor Qloo.** The categories are Qloo's own tags. Qloo files some brands in places a person would not, for example White Claw and BeatBox under `wine_and_spirits:spirits`, so a model asked for "spirits" is unlikely to name them. Those rows are kept, as in the backtest. The per-category table in `results.md` shows the effect.
- **The sponsor lists are incomplete.** `festivals.json` holds what the partner pages showed at the time (archived links per row). Real sponsors may be missing, and some listed ones may be partners rather than paid sponsors. Both sides are scored against the same list, so this adds noise, not bias.
- **Large festivals, not small events.** The same caveat as the backtest: no public sponsor lists exist for the events the app is for.
- **Top 10 out of 10.** The model gives 10 names; Qloo ranked up to 50. Only the top-10 metric is comparable, and Qloo's short lists (fewer than 10 brands) made some of its top-10 finishes easier. The "full lists only" subset shows this for both.
- **A model is not deterministic.** Hence 3 runs and the range. 3 runs show the spread; they do not give a significance test, and none is claimed.
- **One model.** The result is about this model with this prompt, not about language models in general.

## 12. Script (`backtest-llm/run.mjs`)

**Commands:**

- `node backtest-llm/run.mjs --dry-run` makes **no calls** and needs no key. It prints the number of calls of each kind, the cost estimate, the full prompts for one festival (one category prompt and one memorization prompt), and the line-up and city sent for every festival. It also checks the inputs against the backtest:
  - it rebuilds Qloo's numbers (32/129 own top 10, 178/1,052 control) from `backtest/results.json`;
  - it checks the control festivals row by row against the backtest's own control look-ups, and stops with an error if any row differs.
- `node --env-file=.env.local backtest-llm/run.mjs --run 1` makes the calls for run 1 only. Without `--run`, it makes the calls for all runs. It then scores, once every call is in `raw/`.
- `node backtest-llm/run.mjs --score` makes no calls; it scores again from `raw/`, for example after the manual check.
- `--retry-failed` calls failed lists again (section 8).
- `--write-manual` writes a manual list longer than 150 lines (section 7).

**Reads (read only):**

- `backtest/festivals.json`
- `backtest/results.json`: tested rows, tags, `qlooName`, list sizes, control ranks.
- `backtest/results.md`: the two missing headliners and the two cities Qloo dropped, which are not in the JSON. The script checks they are still there.

Nothing in `backtest/` is written. `tokens()` and `pct()` are copied from `backtest/run.mjs` with a comment, because that file calls Qloo as soon as it is loaded.

**API key:**

- Read from `OPENROUTER_API_KEY` or `LLM_API_KEY`, loaded from `.env.local` by `--env-file`.
- The key is never printed, logged or saved.
- Error text is passed through a filter that replaces anything shaped like `sk-or-…` with `[key]` before it is logged or saved.
- The script stops if no key is set.

**Requests:**

- Sent to `https://openrouter.ai/api/v1/chat/completions` with the header `X-Title: Echolocate backtest`.
- At most **3 calls at once**, with a 60 s timeout each.

**Raw data:** one file per call, saved as soon as the call ends:

- `backtest-llm/raw/run-{1,2,3}/{festival-slug}__{tag}.json` for brand lists,
- `backtest-llm/raw/run-N/memorization__{festival-slug}.json` for memorization calls.

Each file holds the prompt, the settings, every attempt (status, full reply text, `usage`, cost, provider, model, time) and the parsed list. There is no key in them.

- **Resuming:** the script can be stopped and run again. A call whose file exists is not made again.
- **Size:** expected about 3 MB for 777 files. They are committed with the results so anyone can check them, unless they pass 10 MB; then they go into `.gitignore` and `results.md` says so.

**Outputs:**

- `backtest-llm/results.md`: tables with Qloo's numbers next to each LLM number, the memorization guesses, failed lists, brands per list, tokens and cost.
- `backtest-llm/results.json`
- `backtest-llm/manual-check.md` (section 7)

**Tested before any call (19 Oct, with fake replies, no network):**

- scoring,
- the manual list and the "yes" approvals,
- resuming from `raw/`,
- the cost brake (stopped at $1.50),
- the 5% stop rule,
- key redaction.

**Order of work:**

1. Yasin approves the dry run.
2. Run 1, then check the files.
3. Runs 2 and 3.
4. Manual check.
5. `--score`, then `results.md` is read and claims are decided (section 9).

## Decisions (made by Yasin on 19 Oct 2026, before any run or result)

- **A. Levels:** product level only (129 rows, 249 lists). The broad level is not run.
- **B. Question:** "brands this audience likes most", the same question Qloo answers. The word "sponsor" is not in the prompt.
- **C. Provider:** DigitalOcean only, `allow_fallbacks: false`. If more than 5% of calls fail after one retry, stop and report; never switch provider without Yasin.
- **D. Memorization:** 30 calls (once per festival per run, temperature 0.7). A festival counts as memorized if the model names it in at least 1 of 3 runs.

## Changes after this plan was written

- **19 Oct 2026, before any run, approved by Yasin:**
  - Decisions A–D as above.
  - `max_tokens` 300 → 800. Cut-off or unreadable replies are retried once; if they still fail, they count as empty lists and are reported separately.
  - The manual list holds only close look-alikes (shared non-generic word, or edit distance ≤ 2). If it has more than 150 lines, the count is reported before the file is written.
  - Lists longer than 10 are cut to the first 10, duplicates are removed, and shorter lists are used as they are. The average number of brands per list is reported.
  - Concurrency 2 → 3. Cost brake $1.50 counted from `usage.cost`.
  - The cost section is redone for DigitalOcean only.
