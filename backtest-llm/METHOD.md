# Qloo vs a language model alone: test plan

Status: **plan only, not run.** Written 19 Oct 2026, before any model call. Nothing in this file may change after the first run starts, except to fix a typo; any other change is logged at the bottom with the date and the reason.

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
- **Broad level (optional, decision A below):** the backtest also reports 16 broad tags. That level has 157 rows tested, 158 usable lists, and Qloo got **13% vs control 7%**. If it is run, it uses the same rules with the broad tag in place of the product tag.

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
- `max_tokens: 300`
- No `response_format`, the same as the app; the reply's outermost `{...}` is parsed.
- One user message per list. No conversation history between calls.

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

The question mirrors what Qloo was asked: the brands this audience has the strongest taste for in a category, not "who would sponsor". Decision B below covers the alternative wording.

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

For each festival, the call in section 3b is made once per run (3 runs, so 3 guesses per festival).

- **Flagged:** a festival is flagged if any of its 3 guesses names the right festival. "Right" means the guess, normalized with the section 7 rules, contains the festival's core name: Coachella, Stagecoach, BottleRock, Sonic Temple, Boston Calling, Bonnaroo, Hangout, Sueños / Suenos, Ultra, Dreamville. The year does not have to be right.
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

**Everything else goes on the manual list (`backtest-llm/manual-check.md`) and is not counted automatically.** That includes:

- Partial name matches, using `nameMatch() === "partial"` from `run.mjs`. Example: "Don Julio" vs "Don Julio Blanco".
- Parent vs child brands. Examples: "Anheuser-Busch" for "Bud Light", "Google" for "Google Pixel" when "Google" is not the `qlooName`, "Marriott" for "Marriott Bonvoy American Express".
- Same company under another name, or spelling differences that normalization does not catch.

The list is built for every sponsor row: any model answer in that festival and category that shares a word of 4+ letters with the sponsor name or `qlooName` goes on the list. Yasin marks each line as "same brand" or "not the same".

**Rule set now:** a parent company is **not** the same as a child brand, and a child brand is not the same as its parent, unless one of them is the sponsor name or the `qlooName`.

Results are reported **automatic only**, and **automatic + manually approved**, in separate rows. The headline number is the automatic one.

## 8. Runs

- The full test is run **3 times**: 3 × 249 lists, plus the memorization calls.
- Each run is a fresh set of calls, with no cache between runs.
- For each metric (own top 10, control top 10, own top 5, the subsets, with and without flagged festivals), report the **mean of the 3 runs and the range (lowest – highest)**.
- Qloo's numbers come from one run. Qloo's API returns the same list for the same query, so it has no spread to report.

**Failed calls:** a call that errors, or returns no usable JSON, is retried once. If it still fails, its list is counted as **empty** (all misses), not dropped, and the number of such lists per run is reported. If more than 5% of a run's lists end up empty, that run is reported but flagged as not reliable.

## 9. Reporting rules (fixed before any result is seen)

1. **All results go into `backtest-llm/results.md` as they come out**, including runs that look bad for Qloo, failed calls, and the manual-check list with Yasin's decisions. Raw replies are kept (section 12).
2. **"LLM equal or better than Qloo"** means, at the product level, on all 10 festivals, automatic matching, mean of 3 runs:
   - the LLM's own top-10 rate is **≥ 25%**, **or**
   - the LLM's gap (own − control) is **≥ 8 points**, Qloo's gap.

   If either holds, **we do not use any Qloo-vs-LLM comparison claim** in the pitch, the video or Devpost. That decision is written in `results.md`.
3. **Claims for Devpost are chosen only after the results are in**, and only with Yasin's approval. Until then, the rule in `CLAUDE.local.md` stays: no "better than an LLM" claim.
4. If the comparison only holds without the flagged festivals, or only with manual matches, any claim must say so in the same sentence.
5. Both category levels are reported if both are run. Quoting only the better one is cherry-picking, the same rule as the backtest.

## 10. Calls and cost

**Calls:**

| | Brand lists | Memorization | Total |
|---|---|---|---|
| Product level only | 25 categories × 10 festivals − 1 unusable = 249 lists × 3 runs = **747** | 10 festivals × 3 runs = **30** | **777** |
| Product + broad | (249 + 158) × 3 = **1,221** | **30** | **1,251** |

Retries (section 8) add at most one call per failed list.

**Price** (`/api/v1/models` and `/api/v1/models/deepseek/deepseek-v4.1-flash/endpoints`, read 19 Oct 2026), USD per 1M tokens, input / output:

| Provider | Input | Output | Note |
|---|---|---|---|
| OpenInference | $0.0472 | $0.12 | cheapest; the listed model price |
| Decart | $0.09 | $0.18 | served the 19 Oct pitch test |
| DigitalOcean | $0.195 | $0.78 | served the 19 Oct pitch test |
| BaseTen | $0.60 | $2.40 | most expensive endpoint listed |

**Tokens per call (estimate):** about 450 input tokens and 150 output tokens (10 brand names in JSON). The worst case uses the `max_tokens` cap of 300 output tokens.

| | Cheapest | Decart | DigitalOcean | Most expensive (BaseTen) | BaseTen, every reply at the 300-token cap |
|---|---|---|---|---|---|
| Product only (777 calls) | $0.03 | $0.05 | $0.16 | $0.49 | **$0.77** |
| Product + broad (1,251 calls) | $0.05 | $0.08 | $0.26 | $0.79 | **$1.24** |

The key's limit is $4, and the same key also pays for the live app's pitches.

The script:

- adds up `usage.cost` from every reply,
- **stops before the next call if the run's spend passes $1.50**,
- prints the real token counts and cost at the end.

The table above is updated with the real numbers in `results.md`.

## 11. Known limits

- **Memorization favors the model.** These are large, well-reported festivals, and the model may have read their sponsor lists. A headliner line-up plus a city can be enough to recall the festival, and then its sponsors. Section 6 catches the obvious cases but not all of them: a model can recall sponsors without naming the festival. Any advantage the model shows here may be partly recall, which does not exist for the small events Echolocate is for.
- **Qloo's categories may favor Qloo.** The categories are Qloo's own tags. Qloo files some brands in places a person would not, for example White Claw and BeatBox under `wine_and_spirits:spirits`, so a model asked for "spirits" is unlikely to name them. Those rows are kept, as in the backtest, and listed separately in `results.md` so the effect can be seen.
- **The sponsor lists are incomplete.** `festivals.json` holds what the partner pages showed at the time (archived links per row). Real sponsors may be missing, and some listed ones may be partners rather than paid sponsors. Both sides are scored against the same list, so this adds noise, not bias.
- **Large festivals, not small events.** The same caveat as the backtest: no public sponsor lists exist for the events the app is for.
- **Top 10 out of 10.** The model gives 10 names; Qloo ranked up to 50. Only the top-10 metric is comparable, and Qloo's short lists (fewer than 10 brands) made some of its top-10 finishes easier. The "full lists only" subset shows this for both.
- **A model is not deterministic.** Hence 3 runs and the range. 3 runs show the spread; they do not give a significance test, and none is claimed.
- **One model.** The result is about this model with this prompt, not about language models in general.

## 12. Script plan (`backtest-llm/run.mjs`, not written yet)

- **Run:** `node --env-file=.env.local backtest-llm/run.mjs [--dry-run] [--level product|broad|both]`.
  - `--dry-run` prints the number of calls, the cost estimate and three sample prompts, and makes no calls. It is run first and its output is shown to Yasin before the real run.
- **Reads (read only):** `backtest/festivals.json` and `backtest/results.json` (tested rows, tags, `qlooName`, usable lists, control exclusions). Nothing in `backtest/` is written.
- **API key:** read from `process.env.LLM_API_KEY` or `OPENROUTER_API_KEY` (loaded from `.env.local` by `--env-file`).
  - The key is never printed, logged, or written to any file.
  - Error text from OpenRouter is passed through a filter that replaces anything shaped like `sk-or-…` with `[key]` before it is logged.
  - The script stops if no key is set.
- **Requests:** `https://openrouter.ai/api/v1/chat/completions`, header `X-Title: Echolocate backtest`, at most 2 calls at once, 429/503 retried with backoff.
- **Raw data:** every request and reply is saved as it arrives, without the key:
  - one file per call, `backtest-llm/raw/run-{1,2,3}/{festival-slug}__{tag}.json`, holding the prompt, the full reply, `usage`, provider, model and time;
  - memorization calls in `backtest-llm/raw/run-N/memorization__{festival-slug}.json`.

  A stopped run resumes from the saved files instead of calling again.
- **Outputs:**
  - `backtest-llm/results.md` (tables in the same layout as `backtest/results.md`, with Qloo's numbers next to each LLM number),
  - `backtest-llm/results.json`,
  - `backtest-llm/manual-check.md` (section 7, with an empty "same brand?" column for Yasin).
- **Order of work:**
  1. Write the script.
  2. Yasin approves the dry run.
  3. Run 1.
  4. Check the files.
  5. Runs 2 and 3.
  6. Manual check.
  7. Write `results.md`.

## Decisions that need Yasin before the run

- **A. Levels:** product only (777 calls, at most ~$0.77), or product + broad (1,251 calls, at most ~$1.24)? The backtest reported both.
- **B. Question wording:** "brands this audience likes most" (as written, mirrors Qloo), or "brands most likely to sponsor this event" (closer to how the app is used, but invites recall of real sponsor lists)?
- **C. Provider:** let OpenRouter choose (as the app does; cost and provider vary per call), or fix one provider for all calls with `provider: { order: [...], allow_fallbacks: false }` (more repeatable; must be checked as available first)?
- **D. Memorization call settings:** as written (temperature 0.7, once per run), or temperature 0 once per festival (10 calls, one stable guess)?

## Changes after this plan was written

None yet.
