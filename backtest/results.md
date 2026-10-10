# Backtest: real festival sponsors in Qloo's brand ranking

Run 2026-10-10. 10 US festivals, 230 sponsor rows. Data and sources: `backtest/festivals.json`.

For each sponsor found in Qloo, we asked Qloo for the top 50 brands in the sponsor's own category, for that festival's three headliners and city, and looked up the sponsor's rank.

**Control** is the same brand's rank in the other festivals' lists (festivals it did not sponsor). It shows how often a brand lands near the top just by being popular.

Two category levels are shown so the result does not hinge on a convenient choice. Broad lists mix very different products (beer, wine and spirits in one list of 50), so they are the harder test.

## Broad category (top-level tag)

Tested 157 sponsor rows. Left out: 66 not found in Qloo, 7 with no tag at this level, 0 whose category list was empty or ignored the filter.

| | Tested | Top 5 | Top 10 | Top 25 | Top 50 | Control top 10 | Control top 25 |
|---|---|---|---|---|---|---|---|
| All tested | 157 | 10 (6%) | 21 (13%) | 39 (25%) | 49 (31%) | 7% | 15% |
| Full lists only (50 brands) | 146 | 8 (5%) | 19 (13%) | 37 (25%) | 47 (32%) | 5% | 13% |
| Exact name matches only | 114 | 7 (6%) | 16 (14%) | 28 (25%) | 36 (32%) | 7% | 13% |

By category:

| | Tested | Top 5 | Top 10 | Top 25 | Top 50 | Control top 10 | Control top 25 |
|---|---|---|---|---|---|---|---|
| wine_and_spirits | 64 | 4 (6%) | 9 (14%) | 19 (30%) | 27 (42%) | 4% | 15% |
| food_and_beverage | 20 | 1 (5%) | 3 (15%) | 3 (15%) | 3 (15%) | 4% | 7% |
| fashion | 12 | 1 (8%) | 2 (17%) | 4 (33%) | 5 (42%) | 0% | 1% |
| financial_services | 10 | 1 (10%) | 1 (10%) | 3 (30%) | 3 (30%) | 34% | 36% |
| telecom | 8 | 1 (13%) | 3 (38%) | 3 (38%) | 3 (38%) | 50% | 52% |
| health_and_beauty | 7 | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) | 0% | 3% |
| mobile_app | 7 | 1 (14%) | 1 (14%) | 3 (43%) | 3 (43%) | 3% | 7% |
| automotive | 6 | 1 (17%) | 2 (33%) | 2 (33%) | 2 (33%) | 6% | 8% |
| website | 6 | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) | 6% | 13% |
| travel | 5 | 0 (0%) | 0 (0%) | 0 (0%) | 1 (20%) | 0% | 14% |
| electronics | 3 | 0 (0%) | 0 (0%) | 1 (33%) | 1 (33%) | 0% | 7% |
| software | 3 | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) | 7% | 22% |
| entertainment | 2 | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) | 0% | 0% |
| dining | 2 | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) | 0% | 11% |
| household | 1 | 0 (0%) | 0 (0%) | 1 (100%) | 1 (100%) | 11% | 67% |
| industrials | 1 | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) | 14% | 29% |

By festival:

| | Tested | Top 5 | Top 10 | Top 25 | Top 50 | Control top 10 | Control top 25 |
|---|---|---|---|---|---|---|---|
| BottleRock Napa Valley | 32 | 2 (6%) | 3 (9%) | 6 (19%) | 9 (28%) | 8% | 14% |
| Coachella Valley Music and Arts Festival | 24 | 0 (0%) | 3 (13%) | 10 (42%) | 12 (50%) | 6% | 11% |
| Stagecoach | 21 | 2 (10%) | 4 (19%) | 6 (29%) | 7 (33%) | 9% | 16% |
| Bonnaroo Music & Arts Festival | 16 | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) | 10% | 19% |
| Hangout Music Fest | 15 | 3 (20%) | 4 (27%) | 4 (27%) | 6 (40%) | 4% | 11% |
| Sueños Music Festival | 14 | 2 (14%) | 2 (14%) | 2 (14%) | 3 (21%) | 10% | 18% |
| Sonic Temple Art + Music Festival | 11 | 1 (9%) | 1 (9%) | 4 (36%) | 5 (45%) | 9% | 19% |
| Boston Calling Music Festival | 10 | 0 (0%) | 1 (10%) | 1 (10%) | 1 (10%) | 5% | 14% |
| Dreamville Festival | 8 | 0 (0%) | 1 (13%) | 3 (38%) | 3 (38%) | 2% | 13% |
| Ultra Music Festival | 6 | 0 (0%) | 2 (33%) | 3 (50%) | 3 (50%) | 6% | 13% |

Sponsors ranked in the top 10 for their own festival:

| Festival | Sponsor | Category | Rank | Rank at festivals it did not sponsor |
|---|---|---|---|---|
| Sueños Music Festival 2025 | Don Julio (Qloo: Don Julio Tequila) | wine_and_spirits | #1 of 50 | >50, >50, >50, >50, >50, >50, #30, #26 |
| BottleRock Napa Valley 2025 | Marriott Bonvoy American Express (Qloo: American Express) | financial_services | #2 of 50 | #3, #2, >50, >50, #1, #3, #6 |
| Hangout Music Fest 2023 | Shein | mobile_app | #2 of 50 | #5, >50, >50, >50, #32, >50, >50, #15 |
| Hangout Music Fest 2023 | Ford Bronco | automotive | #2 of 12 | >50, #3, >50, #5, >50, >50, >50, >50, #1 |
| Sueños Music Festival 2025 | Verizon (Qloo: Verizon Wireless) | telecom | #2 of 8 | #8, #9, #1, #3, #1, #5, #2 |
| Stagecoach 2025 | Twisted Tea | wine_and_spirits | #3 of 50 | >50, >50, >50, >50, >50, >50, >50, >50 |
| BottleRock Napa Valley 2025 | White Claw | wine_and_spirits | #3 of 50 | #36, #3, >50, #3, #32, #11 |
| Sonic Temple Art + Music Festival 2025 | Bud Light | wine_and_spirits | #4 of 50 | #28, >50, #22, >50, #11, #35, >50, #36 |
| Stagecoach 2025 | Ariat | fashion | #5 of 50 | >50, >50, >50, >50, >50, >50, >50, >50, >50 |
| Hangout Music Fest 2023 | Coca-Cola | food_and_beverage | #5 of 50 | >50, >50, >50, >50, >50, >50 |
| BottleRock Napa Valley 2025 | lululemon | fashion | #6 of 50 | >50, >50, >50, #43, >50, >50, >50, >50, >50 |
| Boston Calling Music Festival 2023 | Dunkin' (Qloo: Dunkin' Donuts) | food_and_beverage | #6 of 50 | #12, >50, >50, #2, >50, #4, #5, >50, #13 |
| Dreamville Festival 2025 | Hennessy | wine_and_spirits | #6 of 50 | #9, >50, >50, >50, >50, >50, >50 |
| Coachella Valley Music and Arts Festival 2025 | BMW | automotive | #7 of 50 | >50, >50, >50, >50, >50, >50, >50, >50, >50 |
| Stagecoach 2025 | Bud Light | wine_and_spirits | #7 of 50 | #28, >50, #22, >50, #11, #35, >50, #36 |
| Ultra Music Festival 2025 | Hennessy | wine_and_spirits | #8 of 50 | #9, >50, >50, >50, >50, >50, >50 |
| Hangout Music Fest 2023 | BeatBox (Qloo: BeatBox Beverages) | wine_and_spirits | #9 of 50 | >50, >50, #40, >50, >50, #12, #23 |
| Ultra Music Festival 2025 | Dom Pérignon | wine_and_spirits | #9 of 50 | #49, >50, >50, >50, >50, >50, >50, #14, >50 |
| Coachella Valley Music and Arts Festival 2025 | Coca-Cola | food_and_beverage | #10 of 50 | >50, >50, >50, >50, >50, >50 |
| Coachella Valley Music and Arts Festival 2025 | T-Mobile | telecom | #10 of 50 | >50, #8, >50, >50, >50, #5, #2, #8 |
| Stagecoach 2025 | T-Mobile | telecom | #10 of 50 | >50, #8, >50, >50, >50, #5, #2, #8 |

## Product category (second-level tag, the level the app uses)

Tested 129 sponsor rows. Left out: 66 not found in Qloo, 35 with no tag at this level, 0 whose category list was empty or ignored the filter.

| | Tested | Top 5 | Top 10 | Top 25 | Top 50 | Control top 10 | Control top 25 |
|---|---|---|---|---|---|---|---|
| All tested | 129 | 19 (15%) | 32 (25%) | 47 (36%) | 68 (53%) | 17% | 28% |
| Full lists only (50 brands) | 103 | 13 (13%) | 22 (21%) | 37 (36%) | 57 (55%) | 14% | 25% |
| Exact name matches only | 92 | 15 (16%) | 25 (27%) | 34 (37%) | 50 (54%) | 19% | 28% |

By category:

| | Tested | Top 5 | Top 10 | Top 25 | Top 50 | Control top 10 | Control top 25 |
|---|---|---|---|---|---|---|---|
| wine_and_spirits:spirits | 41 | 3 (7%) | 6 (15%) | 17 (41%) | 26 (63%) | 10% | 24% |
| wine_and_spirits:beer | 17 | 4 (24%) | 5 (29%) | 6 (35%) | 8 (47%) | 22% | 39% |
| food_and_beverage:drinks | 14 | 2 (14%) | 3 (21%) | 3 (21%) | 6 (43%) | 9% | 13% |
| fashion:casual | 7 | 1 (14%) | 2 (29%) | 3 (43%) | 4 (57%) | 3% | 11% |
| food_and_beverage:food | 6 | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) | 2% | 2% |
| mobile_app:financial_services | 6 | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) | 46% | 50% |
| mobile_app:food_and_dining | 4 | 0 (0%) | 4 (100%) | 4 (100%) | 4 (100%) | 67% | 77% |
| wine_and_spirits:wine | 4 | 2 (50%) | 3 (75%) | 4 (100%) | 4 (100%) | 42% | 56% |
| automotive:car_and_suv | 4 | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) | 0% | 3% |
| travel:airline | 3 | 0 (0%) | 1 (33%) | 1 (33%) | 2 (67%) | 48% | 68% |
| fashion:accessories | 3 | 0 (0%) | 0 (0%) | 1 (33%) | 1 (33%) | 7% | 7% |
| health_and_beauty:skincare | 2 | 1 (50%) | 1 (50%) | 1 (50%) | 2 (100%) | 25% | 25% |
| entertainment:media | 2 | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) | 0% | 0% |
| mobile_app:streaming_service | 2 | 1 (50%) | 1 (50%) | 1 (50%) | 1 (50%) | 39% | 44% |
| fashion:footwear | 2 | 0 (0%) | 0 (0%) | 0 (0%) | 1 (50%) | 0% | 0% |
| mobile_app:e_commerce | 2 | 1 (50%) | 1 (50%) | 1 (50%) | 2 (100%) | 38% | 50% |
| travel:hotel | 2 | 0 (0%) | 0 (0%) | 0 (0%) | 2 (100%) | 17% | 44% |
| electronics:home_theater | 1 | 0 (0%) | 1 (100%) | 1 (100%) | 1 (100%) | 56% | 56% |
| automotive:electric | 1 | 1 (100%) | 1 (100%) | 1 (100%) | 1 (100%) | 11% | 11% |
| electronics:phones_and_tablets | 1 | 1 (100%) | 1 (100%) | 1 (100%) | 1 (100%) | 0% | 11% |
| mobile_app:photo_and_video | 1 | 1 (100%) | 1 (100%) | 1 (100%) | 1 (100%) | 0% | 11% |
| electronics:computer_components | 1 | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) | 11% | 22% |
| fashion:athletic | 1 | 1 (100%) | 1 (100%) | 1 (100%) | 1 (100%) | 44% | 67% |
| mobile_app:social_networking | 1 | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) | 0% | 78% |
| financial_services:credit_card | 1 | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) | 13% | 25% |

By festival:

| | Tested | Top 5 | Top 10 | Top 25 | Top 50 | Control top 10 | Control top 25 |
|---|---|---|---|---|---|---|---|
| BottleRock Napa Valley | 23 | 3 (13%) | 3 (13%) | 6 (26%) | 12 (52%) | 13% | 29% |
| Coachella Valley Music and Arts Festival | 20 | 6 (30%) | 9 (45%) | 12 (60%) | 14 (70%) | 14% | 20% |
| Stagecoach | 17 | 3 (18%) | 6 (35%) | 6 (35%) | 11 (65%) | 21% | 28% |
| Bonnaroo Music & Arts Festival | 12 | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) | 26% | 41% |
| Hangout Music Fest | 12 | 2 (17%) | 3 (25%) | 5 (42%) | 7 (58%) | 9% | 16% |
| Sonic Temple Art + Music Festival | 11 | 1 (9%) | 2 (18%) | 6 (55%) | 8 (73%) | 22% | 38% |
| Sueños Music Festival | 11 | 1 (9%) | 2 (18%) | 2 (18%) | 5 (45%) | 12% | 25% |
| Boston Calling Music Festival | 9 | 1 (11%) | 3 (33%) | 3 (33%) | 4 (44%) | 29% | 36% |
| Dreamville Festival | 8 | 1 (13%) | 2 (25%) | 4 (50%) | 4 (50%) | 13% | 30% |
| Ultra Music Festival | 6 | 1 (17%) | 2 (33%) | 3 (50%) | 3 (50%) | 15% | 23% |

Sponsors ranked in the top 10 for their own festival:

| Festival | Sponsor | Category | Rank | Rank at festivals it did not sponsor |
|---|---|---|---|---|
| Coachella Valley Music and Arts Festival 2025 | Neutrogena | health_and_beauty:skincare | #1 of 44 | >50, >50, >50, >50, #5, >50, #8, >50 |
| Hangout Music Fest 2023 | Shein | mobile_app:e_commerce | #1 of 24 | #1, >50, >50, >50, #3, >50, #14, #5 |
| Sueños Music Festival 2025 | Don Julio (Qloo: Don Julio Tequila) | wine_and_spirits:spirits | #1 of 50 | #47, >50, #45, >50, >50, >50, #24, #21 |
| Coachella Valley Music and Arts Festival 2025 | Pinterest | mobile_app:photo_and_video | #2 of 26 | #11, >50, >50, >50, >50, >50, >50, >50, >50 |
| Coachella Valley Music and Arts Festival 2025 | YouTube | mobile_app:streaming_service | #2 of 39 | #17, >50, >50, >50, >50, >50, >50, >50, >50 |
| Stagecoach 2025 | Ariat | fashion:casual | #2 of 50 | >50, >50, >50, >50, >50, >50, >50, >50, >50 |
| Stagecoach 2025 | Barefoot (Qloo: Barefoot Wine) | wine_and_spirits:wine | #2 of 50 | #3, #4, #3, #2, #4, #3, #9, #21, #10 |
| BottleRock Napa Valley 2025 | lululemon | fashion:athletic | #2 of 50 | #20, #38, #11, #3, >50, #5, #8, >50, #9 |
| BottleRock Napa Valley 2025 | White Claw | wine_and_spirits:spirits | #2 of 50 | #16, #2, >50, #1, #22, #9 |
| Sonic Temple Art + Music Festival 2025 | Bud Light | wine_and_spirits:beer | #2 of 50 | #6, >50, #11, >50, #2, #7, >50, #3 |
| Ultra Music Festival 2025 | Dom Pérignon | wine_and_spirits:wine | #2 of 50 | #6, >50, #31, >50, #14, >50, >50, #2, >50 |
| Coachella Valley Music and Arts Festival 2025 | BMW | automotive:electric | #3 of 16 | #8, >50, >50, >50, >50, >50, >50, >50, >50 |
| Coachella Valley Music and Arts Festival 2025 | Google Pixel (Qloo: Google) | electronics:phones_and_tablets | #3 of 46 | #15, >50, >50, >50, >50, >50, >50, >50, >50 |
| Stagecoach 2025 | Bud Light | wine_and_spirits:beer | #4 of 50 | #6, >50, #11, >50, #2, #7, >50, #3 |
| BottleRock Napa Valley 2025 | Lagunitas Brewing Company | wine_and_spirits:beer | #4 of 50 | >50, >50, #18, #7, #11, >50, #19, >50, #16 |
| Boston Calling Music Festival 2023 | Dunkin' (Qloo: Dunkin' Donuts) | food_and_beverage:drinks | #4 of 50 | #8, >50, >50, #2, >50, #3, #4, >50, #8 |
| Hangout Music Fest 2023 | Coca-Cola | food_and_beverage:drinks | #4 of 50 | >50, >50, >50, >50, >50, >50 |
| Coachella Valley Music and Arts Festival 2025 | Heineken | wine_and_spirits:beer | #5 of 50 | >50, >50, >50, >50, >50, >50, >50, >50, >50 |
| Dreamville Festival 2025 | Hennessy | wine_and_spirits:spirits | #5 of 50 | #5, >50, >50, >50, >50, >50, >50 |
| Coachella Valley Music and Arts Festival 2025 | Coca-Cola | food_and_beverage:drinks | #6 of 50 | >50, >50, >50, >50, >50, >50 |
| Stagecoach 2025 | Alaska Airlines | travel:airline | #6 of 50 | #4, #8, #6, >50, >50, #7, #11, #7 |
| Stagecoach 2025 | Código 1530 (Qloo: Código 1530 Tequila) | wine_and_spirits:spirits | #6 of 50 | #20, >50, >50, >50, #47, #50, >50, >50 |
| Sonic Temple Art + Music Festival 2025 | Michelob Ultra | wine_and_spirits:beer | #6 of 50 | #11, #5, #15, #31, >50, #4, #5, #2, #2 |
| Hangout Music Fest 2023 | BeatBox (Qloo: BeatBox Beverages) | wine_and_spirits:spirits | #6 of 50 | >50, #37, #17, #33, >50, #9, #18 |
| Boston Calling Music Festival 2023 | Josh Cellars (Qloo: Josh Cellars Wine) | wine_and_spirits:wine | #7 of 50 | #28, #1, #9, #9, >50, #11, #15, #6, #9 |
| Sueños Music Festival 2025 | DoorDash | mobile_app:food_and_dining | #7 of 24 | #11, #4, #5, #6, >50, >50, #7 |
| Ultra Music Festival 2025 | Hennessy | wine_and_spirits:spirits | #7 of 50 | #5, >50, >50, >50, >50, >50, >50 |
| Coachella Valley Music and Arts Festival 2025 | Anker | electronics:home_theater | #8 of 36 | #5, #1, #1, >50, #1, >50, >50, >50, #5 |
| Dreamville Festival 2025 | DoorDash | mobile_app:food_and_dining | #8 of 26 | #11, #4, #5, #6, >50, >50, #7 |
| Coachella Valley Music and Arts Festival 2025 | Postmates | mobile_app:food_and_dining | #9 of 50 | #6, #3, #5, #4, >50, #8, #4, #1, #2 |
| Stagecoach 2025 | Wrangler | fashion:casual | #9 of 50 | >50, >50, >50, >50, >50, >50, >50, >50, >50 |
| Boston Calling Music Festival 2023 | DoorDash | mobile_app:food_and_dining | #10 of 23 | #11, #4, #5, #6, >50, >50, #7 |

## Category lists

| Category tag | Usable lists | List sizes per festival | Problem |
|---|---|---|---|
| automotive | 10/10 | 50, 50, 24, 23, 12, 8, 12, 10, 30, 18 |  |
| automotive:car_and_suv | 10/10 | 50, 50, 9, 10, 5, 4, 4, 3, 12, 6 |  |
| automotive:electric | 10/10 | 16, 16, 5, 3, 3, 1, 1, 2, 4, 2 |  |
| dining | 10/10 | 50, 50, 50, 50, 50, 50, 50, 50, 50, 50 |  |
| electronics | 10/10 | 50, 50, 50, 50, 50, 50, 50, 50, 50, 50 |  |
| electronics:computer_components | 10/10 | 36, 36, 4, 10, 8, 2, 5, 6, 5, 12 |  |
| electronics:home_theater | 10/10 | 36, 36, 3, 7, 3, 4, 4, 4, 4, 9 |  |
| electronics:phones_and_tablets | 10/10 | 46, 46, 5, 5, 3, 5, 4, 5, 5, 4 |  |
| entertainment | 10/10 | 50, 50, 50, 50, 50, 50, 50, 50, 50, 50 |  |
| entertainment:media | 10/10 | 50, 50, 50, 50, 50, 50, 50, 50, 50, 50 |  |
| fashion | 10/10 | 50, 50, 50, 50, 50, 50, 50, 50, 50, 50 |  |
| fashion:accessories | 10/10 | 50, 50, 50, 50, 50, 50, 50, 50, 50, 50 |  |
| fashion:athletic | 10/10 | 50, 50, 50, 50, 50, 50, 50, 50, 50, 50 |  |
| fashion:casual | 10/10 | 50, 50, 50, 50, 50, 50, 50, 50, 50, 50 |  |
| fashion:footwear | 10/10 | 50, 50, 50, 50, 50, 50, 50, 50, 50, 50 |  |
| financial_services | 10/10 | 50, 50, 50, 50, 50, 30, 50, 50, 50, 50 |  |
| financial_services:credit_card | 9/10 | 16, 16, 1, 1, 1, 0, 1, 1, 1, 1 | empty |
| food_and_beverage | 10/10 | 50, 50, 50, 50, 50, 50, 50, 50, 50, 50 |  |
| food_and_beverage:drinks | 10/10 | 50, 50, 50, 50, 50, 45, 50, 50, 50, 50 |  |
| food_and_beverage:food | 10/10 | 50, 50, 50, 50, 50, 50, 50, 50, 50, 50 |  |
| health_and_beauty | 10/10 | 50, 50, 50, 50, 50, 50, 50, 50, 50, 50 |  |
| health_and_beauty:skincare | 10/10 | 44, 44, 21, 20, 21, 9, 28, 21, 26, 27 |  |
| household | 10/10 | 50, 50, 50, 50, 50, 12, 50, 50, 39, 50 |  |
| industrials | 8/10 | 46, 46, 2, 2, 2, 0, 4, 0, 4, 3 | empty |
| mobile_app | 10/10 | 50, 50, 50, 50, 50, 50, 50, 50, 50, 50 |  |
| mobile_app:e_commerce | 10/10 | 50, 50, 26, 27, 23, 15, 24, 28, 33, 28 |  |
| mobile_app:financial_services | 10/10 | 50, 50, 11, 18, 13, 7, 11, 15, 16, 18 |  |
| mobile_app:food_and_dining | 10/10 | 50, 50, 22, 23, 23, 2, 20, 24, 19, 26 |  |
| mobile_app:photo_and_video | 10/10 | 26, 26, 7, 10, 10, 3, 9, 8, 9, 10 |  |
| mobile_app:social_networking | 10/10 | 50, 50, 18, 23, 23, 14, 16, 22, 18, 22 |  |
| mobile_app:streaming_service | 10/10 | 39, 39, 8, 14, 12, 4, 16, 12, 11, 13 |  |
| software | 10/10 | 50, 50, 50, 50, 50, 50, 50, 50, 50, 50 |  |
| telecom | 10/10 | 50, 50, 7, 9, 7, 7, 8, 8, 13, 10 |  |
| travel | 10/10 | 50, 50, 50, 50, 50, 50, 50, 50, 50, 50 |  |
| travel:airline | 10/10 | 50, 50, 27, 13, 36, 11, 10, 27, 42, 13 |  |
| travel:hotel | 10/10 | 50, 50, 50, 50, 50, 50, 50, 50, 50, 50 |  |
| website | 10/10 | 50, 50, 50, 50, 50, 50, 50, 50, 50, 50 |  |
| wine_and_spirits | 10/10 | 50, 50, 50, 50, 50, 50, 50, 50, 50, 50 |  |
| wine_and_spirits:beer | 10/10 | 50, 50, 50, 50, 50, 50, 50, 50, 25, 50 |  |
| wine_and_spirits:spirits | 10/10 | 50, 50, 50, 50, 50, 50, 50, 50, 50, 50 |  |
| wine_and_spirits:wine | 10/10 | 50, 50, 50, 49, 50, 19, 37, 50, 50, 50 |  |

## Read this before quoting a number

- These are large festivals. Echolocate is for small events, where no public sponsor list exists to test against.
- Sponsors are bought for many reasons (price, distributor deals, rival exclusivity). A real sponsor missing from the list is not proof the list is wrong.
- The own-festival query includes the festival's city, and so do the control queries for their own cities. Part of any gap is location, not line-up.
- Qloo returned nothing for the city of Coachella Valley Music and Arts Festival (Indio, CA) and Stagecoach (Indio, CA), so those lists use the line-up alone, the same fallback the app uses.
- Short lists make a top-10 finish easy. The "Full lists only" rows remove them.
- Both category levels are reported. Quoting only the better one would be cherry-picking.
- This does not compare Qloo with a language model on its own.
- Headliners not found in Qloo: BottleRock Napa Valley: Justin Timberlake (Qloo returned: Justin Timberlake & Anna Kendrick | Justin Timberlake, Chris Stapleton | Nelly Furtado & Justin Timberlake and Timbaland | 50 Cent F. Justin Timberlake and Timbaland) / Sueños Music Festival: Don Omar (Qloo returned: Don Omar & Lucenzo | Don Omar Y Daddy Yankee | Don Omar & Kendo Kapponi | Aventura & Don Omar).
