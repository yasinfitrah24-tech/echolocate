# Qloo vs a language model alone: results

Scored 2026-10-23. Method: `backtest-llm/METHOD.md`. Model deepseek/deepseek-v4.1-flash via OpenRouter, provider DigitalOcean only, 3 runs. LLM numbers are the mean of the runs, with the range in brackets.

## Decision (METHOD.md section 9)

Rule check on the headline numbers (product level, all 10 festivals, automatic matching, mean of 3 runs): LLM top 10 = 41.3% (rule: 25% or more), LLM gap over its control = 10.2 points (rule: 8 or more). The rule is met.

**Decided by Yasin, 23 Oct 2026: no Qloo-vs-LLM comparison claim is used** in the pitch, the video or Devpost. On top of the rule, the model named 9 of 10 festivals from the line-up and city alone (memorization check below), so its score is most likely recall of past sponsors, not a reading of the crowd.

Every number below uses automatic name matching only, except the "automatic + manually approved" rows, which follow once `manual-check.md` is answered.

Calls: 777. Lists that failed twice and count as empty: 0. Brands per list: 10.00 on average. Tokens: 110613 in, 38937 out. Cost (usage.cost): $0.0439. Providers that answered: DigitalOcean 777.

## Automatic name matching (headline), all 10 festivals

| | Rows | LLM top 10 | LLM top 5 | LLM control top 10 | Qloo top 10 | Qloo top 5 | Qloo control top 10 |
|---|---|---|---|---|---|---|---|
| All tested | 129 | 41% (41–42%) | 32% (31–33%) | 31% (30–32%) | 25% | 15% | 17% |
| Full lists only (Qloo list had 50 brands) | 103 | 37% (37–38%) | 27% (26–28%) | 26% (25–27%) | 21% | 13% | 14% |
| Exact name matches only (backtest lookup) | 92 | 46% (46–46%) | 38% (36–39%) | 35% (34–36%) | 27% | 16% | 19% |

## Automatic name matching (headline), without memorized festivals (9 left out)

**Only 1 festival left (Stagecoach), with 17 sponsor rows. Too few to draw any conclusion.** Shown only because METHOD.md section 6 asks for it.

| | Rows | LLM top 10 | LLM top 5 | LLM control top 10 | Qloo top 10 | Qloo top 5 | Qloo control top 10 |
|---|---|---|---|---|---|---|---|
| All tested | 17 | 51% (47–53%) | 39% (35–41%) | n/a | 35% | 18% | n/a |
| Full lists only (Qloo list had 50 brands) | 16 | 48% (44–50%) | 35% (31–38%) | n/a | 38% | 19% | n/a |
| Exact name matches only (backtest lookup) | 13 | 64% (62–69%) | 51% (46–54%) | n/a | 31% | 15% | n/a |

## Automatic + manually approved matches

Not computed yet: manual-check.md has no yes/no answers. These numbers follow after the manual check.

## By category (automatic, all festivals, LLM mean of runs)

| Category | Rows | LLM top 10 | Qloo top 10 |
|---|---|---|---|
| wine_and_spirits:spirits | 41 | 32% (29–34%) | 15% |
| travel:airline | 3 | 100% (100–100%) | 33% |
| electronics:home_theater | 1 | 0% (0–0%) | 100% |
| automotive:electric | 1 | 100% (100–100%) | 100% |
| food_and_beverage:food | 6 | 0% (0–0%) | 0% |
| food_and_beverage:drinks | 14 | 62% (57–64%) | 21% |
| electronics:phones_and_tablets | 1 | 100% (100–100%) | 100% |
| wine_and_spirits:beer | 17 | 51% (47–59%) | 29% |
| health_and_beauty:skincare | 2 | 100% (100–100%) | 50% |
| mobile_app:photo_and_video | 1 | 0% (0–0%) | 100% |
| mobile_app:food_and_dining | 4 | 50% (50–50%) | 100% |
| fashion:accessories | 3 | 33% (33–33%) | 0% |
| entertainment:media | 2 | 0% (0–0%) | 0% |
| mobile_app:streaming_service | 2 | 0% (0–0%) | 50% |
| fashion:casual | 7 | 29% (29–29%) | 29% |
| wine_and_spirits:wine | 4 | 42% (25–50%) | 75% |
| fashion:footwear | 2 | 0% (0–0%) | 0% |
| mobile_app:e_commerce | 2 | 17% (0–50%) | 50% |
| automotive:car_and_suv | 4 | 75% (75–75%) | 0% |
| travel:hotel | 2 | 0% (0–0%) | 0% |
| electronics:computer_components | 1 | 0% (0–0%) | 0% |
| mobile_app:financial_services | 6 | 67% (67–67%) | 0% |
| fashion:athletic | 1 | 100% (100–100%) | 100% |
| mobile_app:social_networking | 1 | 100% (100–100%) | 0% |
| financial_services:credit_card | 1 | 0% (0–0%) | 0% |

## Memorization check

The model was given only the line-up and the city, and asked which festival it is. It named 9 of 10 festivals right in at least one run.

| Festival | Guesses (run: festival, year, confidence) | Flagged |
|---|---|---|
| Coachella Valley Music and Arts Festival 2025 | 1: Coachella, 2025, low (right); 2: Coachella, 2025, low (right); 3: Coachella, 2025, low (right) | yes |
| Stagecoach 2025 | 1: Country Thunder, 2024, low (wrong); 2: Country Thunder, 2024, low (wrong); 3: Country Thunder Wisconsin, 2024, low (wrong) | no |
| BottleRock Napa Valley 2025 | 1: BottleRock Napa Valley, 2024, high (right); 2: BottleRock Napa Valley, 2024, high (right); 3: BottleRock Napa Valley, 2024, high (right) | yes |
| Sonic Temple Art + Music Festival 2025 | 1: Sonic Temple Art & Music Festival, 2025, medium (right); 2: Sonic Temple Art & Music Festival, 2025, high (right); 3: Sonic Temple Art & Music Festival, 2025, medium (right) | yes |
| Boston Calling Music Festival 2023 | 1: Boston Calling, 2023, high (right); 2: Boston Calling, 2023, high (right); 3: Boston Calling Music Festival, 2023, medium (right) | yes |
| Bonnaroo Music & Arts Festival 2023 | 1: Bonnaroo, 2023, high (right); 2: Bonnaroo, 2023, high (right); 3: Bonnaroo Music and Arts Festival, 2023, high (right) | yes |
| Hangout Music Fest 2023 | 1: Hangout Music Festival, 2024, low (right); 2: Hangout Music Festival, 2024, low (right); 3: Hangout Music Festival, 2024, high (right) | yes |
| Sueños Music Festival 2025 | 1: Sueños Music Festival, 2024, high (right); 2: Suenos, 2024, high (right); 3: Sueños Music Festival, 2024, high (right) | yes |
| Ultra Music Festival 2025 | 1: Ultra Music Festival, 2024, medium (right); 2: Ultra Music Festival, 2024, medium (right); 3: Ultra Music Festival, 2024, medium (right) | yes |
| Dreamville Festival 2025 | 1: Dreamville Festival, 2022, medium (right); 2: Dreamville Festival, 2022, high (right); 3: Dreamville Festival, 2023, high (right) | yes |

## Data health

| Run | Calls | OK | Failed twice | Retried | Attempts cut off | Brands per list | Lists under 10 | Providers | Cost (usage.cost) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 259 | 259 | 0 | 0 | 0 | 10.00 | 1 | DigitalOcean 259 | $0.0146 |
| 2 | 259 | 259 | 0 | 0 | 0 | 10.00 | 0 | DigitalOcean 259 | $0.0147 |
| 3 | 259 | 259 | 0 | 0 | 0 | 10.00 | 0 | DigitalOcean 259 | $0.0147 |

Lists with fewer than 10 brands (used as they are): Run 1: Sonic Temple Art + Music Festival / mobile_app:e_commerce: 9 brands.

## Limits

- **The model recognized 9 of 10 festivals** from the line-up and city alone (memorization check above). It may also know their sponsor lists, so this test can favor the model. The subset without recognized festivals is too small to correct for it.
- Recall of sponsors can happen without naming the festival, so the memorization check does not catch every case.
- The categories are Qloo's own tags (for example White Claw under spirits), which can favor Qloo. The by-category table shows where.
- The sponsor lists in `backtest/festivals.json` are what the partner pages showed and may be incomplete; both sides are scored against the same list.
- These are large festivals; Echolocate is for small events, where no public sponsor lists exist.
- The model lists 10 brands; Qloo ranked up to 50. Only top 10 (and top 5) are compared. Qloo's short lists made some of its top-10 finishes easier; see the "full lists only" rows.
- 3 runs show the spread between runs; no significance test is done or claimed.
- One model with one prompt; this says nothing about language models in general.
- Name matching is automatic only until the manual check is answered.

## Lists that failed twice (counted as empty)

None.

## Manual check

17 sponsor / answer pairs need a look (section 7), listed in `manual-check.md`. Not reviewed yet; every number above uses automatic matching only.
