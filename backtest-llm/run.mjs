// Qloo vs a language model alone. The plan, and every rule this script
// follows, is in backtest-llm/METHOD.md; read that first.
//
// Run from the project root:
//   node backtest-llm/run.mjs --dry-run                     no calls: counts, cost estimate, sample prompts
//   node --env-file=.env.local backtest-llm/run.mjs --run 1 make run 1's calls only (resumes from raw/)
//   node --env-file=.env.local backtest-llm/run.mjs         make every run's calls, then score
//   node backtest-llm/run.mjs --score                       no calls: score what is in raw/ again
// Extra flags:
//   --retry-failed   call again the lists that failed twice in an earlier session
//   --write-manual   write manual-check.md even when it has more than 150 lines
//
// Reads backtest/festivals.json, backtest/results.json and backtest/results.md.
// Never writes anything in backtest/.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const backtestDir = join(here, "..", "backtest");
const rawDir = join(here, "raw");

// ---------- settings (METHOD.md sections 3, 8, 10) ----------

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "deepseek/deepseek-v4.1-flash";
// One provider for every call, no fallback (decision C).
const PROVIDER = { order: ["digitalocean"], allow_fallbacks: false };
const TEMPERATURE = 0.7;
const MAX_TOKENS = 800;
const RUNS = 3;
const CONCURRENCY = 3;
const COST_BRAKE_USD = 1.5;
/** Stop when more than this share of finished calls failed twice (decision C). */
const FAIL_LIMIT = 0.05;
/** Only judge the failure rate once this many calls have finished. */
const FAIL_MIN_CALLS = 20;
/** DigitalOcean price for this model, USD per 1M tokens, read 19 Oct 2026. */
const PRICE = { input: 0.195, output: 0.78 };
/** Tokens per call, for the estimate only (METHOD.md section 10). */
const ESTIMATE = { input: 450, output: 150 };
const LIST_SIZE = 10;
const MANUAL_LIMIT = 150;
const TIMEOUT_MS = 60_000;

const argv = process.argv.slice(2);
const args = new Set(argv);
/** --run N: only that run's calls. Null: every run. */
const ONLY_RUN = argv.includes("--run") ? Number(argv[argv.indexOf("--run") + 1]) : null;
if (ONLY_RUN !== null && !(ONLY_RUN >= 1 && ONLY_RUN <= 3)) throw new Error("--run takes 1, 2 or 3");
const DRY_RUN = args.has("--dry-run");
const SCORE_ONLY = args.has("--score");
const RETRY_FAILED = args.has("--retry-failed");
const WRITE_MANUAL = args.has("--write-manual");

// ---------- backtest data (read only) ----------

const festivals = JSON.parse(readFileSync(join(backtestDir, "festivals.json"), "utf8"));
const backtest = JSON.parse(readFileSync(join(backtestDir, "results.json"), "utf8"));
const backtestMd = readFileSync(join(backtestDir, "results.md"), "utf8");

// The backtest did not save these two facts in results.json; they are in the
// last notes of backtest/results.md, checked below so a rerun of the backtest
// cannot drift away from this list silently.
/** Headliners Qloo could not find, so Qloo's line-up had two artists. */
const MISSING_IN_QLOO = { "BottleRock Napa Valley": ["Justin Timberlake"], "Sueños Music Festival": ["Don Omar"] };
/** Festivals whose city Qloo had no data for: line-up alone, no city. */
const CITY_DROPPED = new Set(["Coachella Valley Music and Arts Festival", "Stagecoach"]);
for (const [festival, names] of Object.entries(MISSING_IN_QLOO)) {
  for (const name of names) {
    if (!backtestMd.includes(`${festival}: ${name}`)) throw new Error(`results.md no longer says ${name} is missing for ${festival}`);
  }
}
for (const festival of CITY_DROPPED) {
  if (!backtestMd.match(new RegExp(`${festival} \\(Indio, CA\\)`))) throw new Error(`results.md no longer says ${festival} used the line-up alone`);
}

/** Core names for the memorization check (METHOD.md section 6). */
const CORE_NAMES = {
  "Coachella Valley Music and Arts Festival": ["coachella"],
  Stagecoach: ["stagecoach"],
  "BottleRock Napa Valley": ["bottlerock", "bottle rock"],
  "Sonic Temple Art + Music Festival": ["sonic temple"],
  "Boston Calling Music Festival": ["boston calling"],
  "Bonnaroo Music & Arts Festival": ["bonnaroo"],
  "Hangout Music Fest": ["hangout"],
  "Sueños Music Festival": ["suenos"],
  "Ultra Music Festival": ["ultra"],
  "Dreamville Festival": ["dreamville"],
};

const productRows = backtest.levels.product.rows;
const tested = productRows.filter((row) => row.status === "tested");
const productTags = backtest.tagHealth.filter((t) => t.tag.split(":").length === 2);
if (productTags.some((t) => t.reasons.includes("filter ignored"))) {
  throw new Error("A product list was 'filter ignored' in the backtest; usable lists cannot be read from list sizes");
}
const festivalIndex = new Map(festivals.map((f, index) => [f.festival, index]));

/** Same rule as backtest/run.mjs: a list is usable when Qloo returned anything. */
function usable(index, tag) {
  const health = productTags.find((t) => t.tag === tag);
  return Boolean(health) && health.sizes[index] > 0;
}

function lineUp(festival) {
  const missing = MISSING_IN_QLOO[festival.festival] ?? [];
  return festival.headliners.filter((name) => !missing.includes(name));
}

function cityFor(festival) {
  return CITY_DROPPED.has(festival.festival) ? null : festival.city;
}

// ---------- name matching ----------

// Copied from backtest/run.mjs, unchanged, so both tests normalize names the
// same way. (Not imported: that file calls Qloo as soon as it is loaded.)
function tokens(name) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** tokens() plus the one extra rule in METHOD.md section 7: a leading "the" is dropped. */
function key(name) {
  const words = tokens(name);
  if (words[0] === "the" && words.length > 1) words.shift();
  return words.join(" ");
}

/** Generic words that do not make two names look alike (METHOD.md section 7). */
const GENERIC = new Set([
  "and", "the", "co", "company", "inc", "group", "brands", "brand", "usa", "america", "american",
  "beer", "brewing", "brewery", "wine", "wines", "cellars", "vineyards", "spirits", "vodka", "tequila",
  "whiskey", "whisky", "rum", "gin", "seltzer", "hard", "water", "drink", "drinks", "energy", "coffee",
  "app", "bank", "card", "credit", "airlines", "airline", "air", "hotels", "hotel", "resorts", "motors",
  "auto", "foods", "food", "beauty", "skin", "care", "music", "tv", "plus", "pay",
  "light", "ultra", "zero", "diet", "classic", "original", "premium", "lager", "ale", "ipa", "club",
]);

function levenshtein(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

/** The names a model answer is compared with: the sponsor name and the name Qloo matched. */
function targetsOf(row) {
  return [...new Set([row.sponsor, row.qlooName].filter(Boolean))];
}

function autoHit(answer, row) {
  const answerKey = key(answer);
  return answerKey !== "" && targetsOf(row).some((target) => key(target) === answerKey);
}

/** A close look-alike for the manual list: a shared non-generic word, or a small edit distance. */
function nearMiss(answer, row) {
  const answerKey = key(answer);
  for (const target of targetsOf(row)) {
    const targetKey = key(target);
    const answerWords = new Set(answerKey.split(" ").filter((w) => w.length >= 3 && !GENERIC.has(w)));
    if (targetKey.split(" ").some((w) => answerWords.has(w))) return "shared word";
    const a = answerKey.replace(/ /g, "");
    const b = targetKey.replace(/ /g, "");
    if (a.length >= 5 && b.length >= 5 && levenshtein(a, b) <= 2) return "edit distance <= 2";
  }
  return null;
}

// ---------- control: the backtest's own rule, checked against its numbers ----------

/** Qloo names a festival's sponsors were matched to (all statuses), for the "also sponsored it" rule. */
const qlooNamesAt = festivals.map((festival) =>
  new Set(productRows.filter((row) => row.festival === festival.festival && row.qlooName).map((row) => row.qlooName)),
);

/** Other festivals a row's control looks at, in the same order as backtest/run.mjs. */
function controlFestivals(row) {
  const own = festivalIndex.get(row.festival);
  const out = [];
  festivals.forEach((_, other) => {
    if (other === own) return;
    if (qlooNamesAt[other].has(row.qlooName)) return;
    if (!usable(other, row.tag)) return;
    out.push(other);
  });
  return out;
}

// Must give back the backtest's control look-ups exactly, row by row.
let controlLookups = 0;
for (const row of tested) {
  const others = controlFestivals(row);
  if (others.length !== row.controlRanks.length) {
    throw new Error(`Control festivals for ${row.festival} / ${row.sponsor}: ${others.length}, backtest had ${row.controlRanks.length}`);
  }
  controlLookups += others.length;
}

// ---------- the calls ----------

function categoryLabel(tag) {
  const text = tag.replace(/_/g, " ").replace(/:/g, " > ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function slug(text) {
  return key(text).replace(/ /g, "-").slice(0, 40);
}

function listMessages(festival, tag) {
  const city = cityFor(festival);
  const user = [
    `Line-up of a live music event: ${lineUp(festival).join(", ")}`,
    ...(city ? [`City: ${city}`] : []),
    `Category: ${categoryLabel(tag)}`,
    "",
    "List the 10 brands in this category that people who come to see this line-up like most, best first. Only real brands. No explanations.",
    "",
    'Return JSON in exactly this shape: {"brands": ["first brand", "second brand", "third brand", "fourth brand", "fifth brand", "sixth brand", "seventh brand", "eighth brand", "ninth brand", "tenth brand"]}',
  ].join("\n");
  return [
    { role: "system", content: "You know which brands different music audiences like. You answer with JSON only, no other text." },
    { role: "user", content: user },
  ];
}

function memoMessages(festival) {
  const city = cityFor(festival);
  const user = [
    `These are the headliners of a music festival in the United States: ${lineUp(festival).join(", ")}`,
    ...(city ? [`City: ${city}`] : []),
    "",
    "Which festival is this, and which year? If you are not sure, give your best guess.",
    "",
    'Return JSON in exactly this shape: {"festival": "name of the festival", "year": 2024, "confidence": "high"}',
    'Use "high", "medium" or "low" for confidence.',
  ].join("\n");
  return [
    { role: "system", content: "You answer with JSON only, no other text." },
    { role: "user", content: user },
  ];
}

const calls = [];
for (let run = 1; run <= RUNS; run += 1) {
  festivals.forEach((festival, index) => {
    for (const { tag } of productTags) {
      if (!usable(index, tag)) continue;
      calls.push({
        kind: "list",
        run,
        index,
        tag,
        file: join(rawDir, `run-${run}`, `${slug(festival.festival)}__${tag.replace(/:/g, "-")}.json`),
        messages: listMessages(festival, tag),
      });
    }
  });
  festivals.forEach((festival, index) => {
    calls.push({
      kind: "memo",
      run,
      index,
      tag: null,
      file: join(rawDir, `run-${run}`, `memorization__${slug(festival.festival)}.json`),
      messages: memoMessages(festival),
    });
  });
}
const listCalls = calls.filter((c) => c.kind === "list").length;
const memoCalls = calls.filter((c) => c.kind === "memo").length;

// ---------- parsing replies (METHOD.md section 3) ----------

/** The reply's outermost {...}, as the app reads it. */
function outerJson(content) {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in the reply");
  return JSON.parse(content.slice(start, end + 1));
}

/** First 10 brands, duplicates removed; fewer than 10 are kept as they are. */
function parseList(content) {
  const data = outerJson(content);
  if (!Array.isArray(data?.brands)) throw new Error('no "brands" list');
  const given = data.brands.filter((b) => typeof b === "string" && b.trim()).map((b) => b.trim());
  const seen = new Set();
  const brands = [];
  for (const brand of given) {
    const k = key(brand);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    brands.push(brand);
    if (brands.length === LIST_SIZE) break;
  }
  return { brands, given: given.length };
}

function parseMemo(content) {
  const data = outerJson(content);
  if (typeof data?.festival !== "string" || !data.festival.trim()) throw new Error('no "festival"');
  return { festival: data.festival.trim(), year: data.year ?? null, confidence: data.confidence ?? null };
}

// ---------- dry run ----------

const estimate = (n, output = ESTIMATE.output) => (n * (ESTIMATE.input * PRICE.input + output * PRICE.output)) / 1e6;

if (DRY_RUN) {
  const sample = festivals.findIndex((f) => f.festival.startsWith("Boston Calling"));
  const sampleTag = "wine_and_spirits:beer";
  const show = (messages) => messages.map((m) => `--- ${m.role} ---\n${m.content}`).join("\n");
  console.log("DRY RUN: no calls are made.\n");
  console.log(`Model ${MODEL}, provider ${JSON.stringify(PROVIDER)}, temperature ${TEMPERATURE}, max_tokens ${MAX_TOKENS}, reasoning effort none`);
  console.log(`Rows tested (product level): ${tested.length}. Categories: ${productTags.length}. Usable lists per run: ${listCalls / RUNS}.`);
  console.log(`Control look-ups (checked row by row against the backtest): ${controlLookups}.`);
  console.log(`Qloo, from backtest/results.json: ${tested.filter((r) => r.rank !== null && r.rank <= 10).length}/${tested.length} own top 10, ${tested.flatMap((r) => r.controlRanks).filter((r) => r !== null && r <= 10).length}/${controlLookups} control top 10.\n`);
  console.log("Calls:");
  console.log(`  brand lists   ${listCalls / RUNS} lists x ${RUNS} runs = ${listCalls}`);
  console.log(`  memorization  ${festivals.length} festivals x ${RUNS} runs = ${memoCalls}`);
  console.log(`  total         ${calls.length} (a retry adds at most one call per failed call)\n`);
  console.log(`Cost estimate at DigitalOcean prices ($${PRICE.input} in / $${PRICE.output} out per 1M tokens):`);
  console.log(`  expected (~${ESTIMATE.input} in, ~${ESTIMATE.output} out per call): $${estimate(calls.length).toFixed(3)}`);
  console.log(`  worst, every reply hits max_tokens ${MAX_TOKENS}:                $${estimate(calls.length, MAX_TOKENS).toFixed(3)}`);
  console.log(`  worst, and every call retried once:                       $${estimate(2 * calls.length, MAX_TOKENS).toFixed(3)}`);
  console.log(`  cost brake: no new call once usage.cost adds up to $${COST_BRAKE_USD.toFixed(2)}\n`);
  const done = calls.filter((c) => existsSync(c.file)).length;
  console.log(`Already in backtest-llm/raw/: ${done} of ${calls.length} calls.\n`);
  console.log(`Sample prompts for ${festivals[sample].festival} (the model never sees this name):\n`);
  console.log(`== Brand list, category ${sampleTag} ==\n${show(listMessages(festivals[sample], sampleTag))}\n`);
  console.log(`== Memorization check ==\n${show(memoMessages(festivals[sample]))}\n`);
  console.log("Line-ups and cities sent:");
  for (const festival of festivals) console.log(`  ${lineUp(festival).join(", ")} | ${cityFor(festival) ?? "(no city)"}`);
  process.exit(0);
}

// ---------- calling ----------

/** Removes anything shaped like an OpenRouter key before text is logged or saved. */
const redact = (text) => String(text).replace(/sk-or-[A-Za-z0-9_-]+/g, "[key]");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readRaw(file) {
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
}

function costOf(record) {
  return (record?.attempts ?? []).reduce((sum, a) => sum + (a.cost ?? 0), 0);
}

async function attempt(apiKey, call) {
  const started = Date.now();
  let response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "X-Title": "Echolocate backtest" },
      body: JSON.stringify({
        model: MODEL,
        messages: call.messages,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        reasoning: { effort: "none" },
        provider: PROVIDER,
        stream: false,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    return { ok: false, error: redact(error instanceof Error ? error.message : error), ms: Date.now() - started, cost: 0 };
  }
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    // handled below
  }
  const usage = data?.usage ?? null;
  // usage.cost is what OpenRouter charged; without it, the DigitalOcean price is used.
  const cost =
    typeof usage?.cost === "number"
      ? usage.cost
      : usage
        ? ((usage.prompt_tokens ?? 0) * PRICE.input + (usage.completion_tokens ?? 0) * PRICE.output) / 1e6
        : 0;
  const base = {
    status: response.status,
    ms: Date.now() - started,
    provider: data?.provider ?? null,
    model: data?.model ?? null,
    id: data?.id ?? null,
    usage,
    cost,
    costEstimated: typeof usage?.cost !== "number",
    retryAfter: response.headers.get("retry-after"),
  };
  if (!response.ok || !data) return { ...base, ok: false, error: redact(text.slice(0, 500)) };
  const choice = data.choices?.[0];
  const content = typeof choice?.message?.content === "string" ? choice.message.content : "";
  const result = { ...base, finishReason: choice?.finish_reason ?? null, content };
  if (choice?.finish_reason === "length") return { ...result, ok: false, error: "cut off (finish_reason length)" };
  try {
    return { ...result, ok: true, parsed: call.kind === "list" ? parseList(content) : parseMemo(content) };
  } catch (error) {
    return { ...result, ok: false, error: `unreadable reply: ${error.message}` };
  }
}

async function makeCalls() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim() || process.env.LLM_API_KEY?.trim();
  if (!apiKey) {
    console.error("No LLM_API_KEY / OPENROUTER_API_KEY. Run with: node --env-file=.env.local backtest-llm/run.mjs");
    process.exit(1);
  }

  let spent = 0;
  let finished = 0;
  let failed = 0;
  const todo = [];
  for (const call of calls) {
    const record = readRaw(call.file);
    spent += costOf(record);
    if (record && (record.ok || !RETRY_FAILED)) {
      finished += 1;
      if (!record.ok) failed += 1;
    } else if (ONLY_RUN === null || call.run === ONLY_RUN) {
      todo.push(call);
    }
  }
  console.log(`${calls.length} calls planned, ${finished} already in raw/ (${failed} failed), ${todo.length} to make. Spent so far: $${spent.toFixed(4)}.`);

  let stopReason = null;
  let next = 0;
  async function worker() {
    while (!stopReason && next < todo.length) {
      if (spent >= COST_BRAKE_USD) {
        stopReason = `cost brake: $${spent.toFixed(4)} spent`;
        break;
      }
      const call = todo[next];
      next += 1;
      const attempts = [await attempt(apiKey, call)];
      spent += attempts[0].cost;
      if (!attempts[0].ok && !stopReason) {
        // One retry (decision C). A rate limit waits for Retry-After, at most 30 s.
        const wait = attempts[0].status === 429 ? Math.min(Number(attempts[0].retryAfter) || 10, 30) * 1000 : 2000;
        await sleep(wait);
        attempts.push(await attempt(apiKey, call));
        spent += attempts[1].cost;
      }
      const last = attempts[attempts.length - 1];
      const record = {
        kind: call.kind,
        run: call.run,
        festival: festivals[call.index].festival,
        tag: call.tag,
        messages: call.messages,
        settings: { model: MODEL, provider: PROVIDER, temperature: TEMPERATURE, max_tokens: MAX_TOKENS, reasoning: "none" },
        ok: last.ok,
        parsed: last.ok ? last.parsed : null,
        attempts,
        savedAt: new Date().toISOString(),
      };
      mkdirSync(dirname(call.file), { recursive: true });
      writeFileSync(call.file, `${JSON.stringify(record, null, 1)}\n`);
      finished += 1;
      if (!last.ok) {
        failed += 1;
        console.log(`  FAILED run ${call.run} ${record.festival} ${call.tag ?? "memorization"}: ${last.error}`);
      }
      if (finished % 25 === 0) console.log(`  ${finished}/${calls.length} done, ${failed} failed, $${spent.toFixed(4)} spent`);
      if (finished >= FAIL_MIN_CALLS && failed / finished > FAIL_LIMIT) {
        stopReason = `${failed} of ${finished} calls failed twice (over ${FAIL_LIMIT * 100}%). Not switching provider; stopping.`;
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`Calls finished: ${finished}/${calls.length}, failed twice: ${failed}, spent: $${spent.toFixed(4)}.`);
  if (stopReason) {
    console.log(`STOPPED: ${stopReason}`);
    process.exit(2);
  }
}

// ---------- scoring ----------

const pct = (part, whole) => (whole === 0 ? "n/a" : `${Math.round((100 * part) / whole)}%`); // same as backtest/run.mjs

/** "yes" lines from manual-check.md, as "sponsor key|answer key". */
function manualApprovals() {
  const file = join(here, "manual-check.md");
  const approved = new Set();
  if (!existsSync(file)) return { approved, exists: false, decided: 0 };
  let decided = 0;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 7 || !/^\d+$/.test(cells[1])) continue;
    const answer = cells[cells.length - 2].toLowerCase();
    if (answer === "yes" || answer === "no") decided += 1;
    if (answer === "yes") approved.add(`${key(cells[2])}|${key(cells[4])}`);
  }
  return { approved, exists: true, decided };
}

function score() {
  const records = calls.map((call) => ({ call, record: readRaw(call.file) }));
  const missing = records.filter((r) => !r.record).length;
  if (missing > 0) {
    console.log(`Not scoring: ${missing} of ${calls.length} calls are not in raw/ yet.`);
    return;
  }

  // Lists per run: run -> "index|tag" -> brand names (empty when the call failed twice).
  const lists = new Map();
  const emptyLists = [];
  const sizes = [];
  const memo = new Map(); // festival index -> guesses
  let totalCost = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  const providers = new Map();
  const health = new Map(); // run -> counts
  for (const { call, record } of records) {
    const h = health.get(call.run) ?? { calls: 0, ok: 0, failed: 0, retried: 0, cut: 0, lists: 0, brands: 0, short: [], cost: 0, providers: new Map() };
    h.calls += 1;
    if (record.ok) h.ok += 1;
    else h.failed += 1;
    if (record.attempts.length > 1) h.retried += 1;
    h.cut += record.attempts.filter((a) => a.finishReason === "length").length;
    h.cost += costOf(record);
    for (const a of record.attempts) {
      const p = a.provider ?? `none (status ${a.status})`;
      h.providers.set(p, (h.providers.get(p) ?? 0) + 1);
    }
    if (call.kind === "list" && record.ok) {
      h.lists += 1;
      h.brands += record.parsed.brands.length;
      if (record.parsed.brands.length < LIST_SIZE) h.short.push(`${record.festival} / ${call.tag}: ${record.parsed.brands.length} brands`);
    }
    health.set(call.run, h);
    totalCost += costOf(record);
    for (const a of record.attempts) {
      tokensIn += a.usage?.prompt_tokens ?? 0;
      tokensOut += a.usage?.completion_tokens ?? 0;
      if (a.provider) providers.set(a.provider, (providers.get(a.provider) ?? 0) + 1);
    }
    if (call.kind === "memo") {
      memo.set(call.index, [...(memo.get(call.index) ?? []), { run: call.run, ...(record.parsed ?? { festival: "(failed)" }) }]);
      continue;
    }
    if (!lists.has(call.run)) lists.set(call.run, new Map());
    const brands = record.ok ? record.parsed.brands : [];
    if (!record.ok) emptyLists.push({ run: call.run, festival: record.festival, tag: call.tag, error: record.attempts.at(-1)?.error });
    else sizes.push(record.parsed.brands.length);
    lists.get(call.run).set(`${call.index}|${call.tag}`, brands);
  }

  // Memorization: flagged when any run's guess names the festival.
  const flagged = new Set();
  festivals.forEach((festival, index) => {
    const names = CORE_NAMES[festival.festival];
    if ((memo.get(index) ?? []).some((g) => names.some((n) => key(g.festival).includes(n)))) flagged.add(index);
  });

  const { approved, exists: manualExists, decided } = manualApprovals();
  /** Manual matches count only once Yasin has answered at least one line. */
  const manualReviewed = decided > 0;
  const manualHit = (answer, row) => approved.has(`${key(row.sponsor)}|${key(answer)}`);

  // Manual list: near misses in every list a row is scored on (own and control), one line per pair.
  const manual = new Map();
  for (const [run, byList] of lists) {
    for (const row of tested) {
      const own = festivalIndex.get(row.festival);
      for (const index of [own, ...controlFestivals(row)]) {
        for (const answer of byList.get(`${index}|${row.tag}`) ?? []) {
          if (autoHit(answer, row)) continue;
          const why = nearMiss(answer, row);
          if (!why) continue;
          const id = `${key(row.sponsor)}|${key(answer)}`;
          const entry = manual.get(id) ?? { row, answer, why, seen: new Set() };
          entry.seen.add(`run ${run}: ${festivals[index].festival}${index === own ? " (own)" : ""}`);
          manual.set(id, entry);
        }
      }
    }
  }

  function rankIn(list, row, withManual) {
    const at = list.findIndex((answer) => autoHit(answer, row) || (withManual && manualHit(answer, row)));
    return at === -1 ? null : at + 1;
  }

  /** One run's numbers for a set of rows, leaving out festivals in `skip`. */
  function llmSummary(run, rows, skip, withManual) {
    const byList = lists.get(run);
    let n = 0, top5 = 0, top10 = 0, controlN = 0, controlTop10 = 0;
    for (const row of rows) {
      const own = festivalIndex.get(row.festival);
      if (skip.has(own)) continue;
      n += 1;
      const rank = rankIn(byList.get(`${own}|${row.tag}`) ?? [], row, withManual);
      if (rank !== null && rank <= 5) top5 += 1;
      if (rank !== null && rank <= 10) top10 += 1;
      for (const other of controlFestivals(row)) {
        if (skip.has(other)) continue;
        controlN += 1;
        if (rankIn(byList.get(`${other}|${row.tag}`) ?? [], row, withManual) !== null) controlTop10 += 1;
      }
    }
    return { n, top5, top10, controlN, controlTop10 };
  }

  /** Qloo's numbers for the same rows and festivals, from backtest/results.json. */
  function qlooSummary(rows, skip) {
    let n = 0, top5 = 0, top10 = 0, controlN = 0, controlTop10 = 0;
    for (const row of rows) {
      if (skip.has(festivalIndex.get(row.festival))) continue;
      n += 1;
      if (row.rank !== null && row.rank <= 5) top5 += 1;
      if (row.rank !== null && row.rank <= 10) top10 += 1;
      controlFestivals(row).forEach((other, i) => {
        if (skip.has(other)) return;
        controlN += 1;
        const rank = row.controlRanks[i];
        if (rank !== null && rank <= 10) controlTop10 += 1;
      });
    }
    return { n, top5, top10, controlN, controlTop10 };
  }

  const runs = [...lists.keys()].sort();
  // Null when there is nothing to count (e.g. no control lists left), shown as "n/a" like pct().
  const rate = (part, whole) => (whole === 0 ? null : (100 * part) / whole);
  const spread = (values) => {
    if (values.some((v) => v === null)) return "n/a";
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    return `${Math.round(mean)}% (${Math.round(Math.min(...values))}–${Math.round(Math.max(...values))}%)`;
  };

  const subsets = [
    ["All tested", tested],
    ["Full lists only (Qloo list had 50 brands)", tested.filter((r) => r.listSize >= 50)],
    ["Exact name matches only (backtest lookup)", tested.filter((r) => r.match === "exact")],
  ];
  const md = [];
  const json = { scoredAt: new Date().toISOString(), runs: runs.length, flagged: [...flagged].map((i) => festivals[i].festival), tables: {} };

  md.push("# Qloo vs a language model alone: results", "");
  md.push(`Scored ${json.scoredAt.slice(0, 10)}. Method: \`backtest-llm/METHOD.md\`. Model ${MODEL} via OpenRouter, provider DigitalOcean only, ${runs.length} runs. LLM numbers are the mean of the runs, with the range in brackets.`, "");
  // Section 9 rule, checked on the headline numbers: product level, all 10
  // festivals, automatic matching, mean of the runs.
  const headline = runs.map((run) => llmSummary(run, tested, new Set(), false));
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  const llmTop10 = mean(headline.map((s) => rate(s.top10, s.n) ?? 0));
  const llmGap = mean(headline.map((s) => (rate(s.top10, s.n) ?? 0) - (rate(s.controlTop10, s.controlN) ?? 0)));
  const ruleMet = llmTop10 >= 25 || llmGap >= 8;
  md.push("## Decision (METHOD.md section 9)", "");
  md.push(`Rule check on the headline numbers (product level, all 10 festivals, automatic matching, mean of ${runs.length} runs): LLM top 10 = ${llmTop10.toFixed(1)}% (rule: 25% or more), LLM gap over its control = ${llmGap.toFixed(1)} points (rule: 8 or more). ${ruleMet ? "The rule is met." : "The rule is not met."}`, "");
  if (ruleMet) {
    md.push(`**Decided by Yasin, 23 Oct 2026: no Qloo-vs-LLM comparison claim is used** in the pitch, the video or Devpost. On top of the rule, the model named ${flagged.size} of ${festivals.length} festivals from the line-up and city alone (memorization check below), so its score is most likely recall of past sponsors, not a reading of the crowd.`, "");
  } else {
    md.push("The rule is not met. Any claim still needs Yasin's approval (section 9.3).", "");
  }
  md.push("Every number below uses automatic name matching only, except the \"automatic + manually approved\" rows, which follow once `manual-check.md` is answered.", "");
  md.push(`Calls: ${calls.length}. Lists that failed twice and count as empty: ${emptyLists.length}. Brands per list: ${(sizes.reduce((s, v) => s + v, 0) / Math.max(sizes.length, 1)).toFixed(2)} on average. Tokens: ${tokensIn} in, ${tokensOut} out. Cost (usage.cost): $${totalCost.toFixed(4)}. Providers that answered: ${[...providers].map(([p, c]) => `${p} ${c}`).join(", ")}.`, "");

  for (const [withManual, title] of [[false, "Automatic name matching (headline)"], [true, "Automatic + manually approved matches"]]) {
    if (withManual && !manualReviewed) {
      md.push(`## ${title}`, "", "Not computed yet: manual-check.md has no yes/no answers. These numbers follow after the manual check.", "");
      continue;
    }
    for (const [skip, scope] of [[new Set(), "all 10 festivals"], [flagged, `without memorized festivals (${flagged.size} left out)`]]) {
      if (scope.startsWith("without") && flagged.size === 0) continue;
      md.push(`## ${title}, ${scope}`, "");
      if (skip.size > 0) {
        const left = festivals.filter((_, i) => !skip.has(i));
        const leftRows = tested.filter((r) => !skip.has(festivalIndex.get(r.festival))).length;
        md.push(`**Only ${left.length} festival${left.length === 1 ? "" : "s"} left (${left.map((f) => f.festival).join(", ")}), with ${leftRows} sponsor rows. Too few to draw any conclusion.** Shown only because METHOD.md section 6 asks for it.`, "");
      }
      md.push("| | Rows | LLM top 10 | LLM top 5 | LLM control top 10 | Qloo top 10 | Qloo top 5 | Qloo control top 10 |", "|---|---|---|---|---|---|---|---|");
      for (const [label, rows] of subsets) {
        const per = runs.map((run) => llmSummary(run, rows, skip, withManual));
        const q = qlooSummary(rows, skip);
        md.push(`| ${label} | ${q.n} | ${spread(per.map((s) => rate(s.top10, s.n)))} | ${spread(per.map((s) => rate(s.top5, s.n)))} | ${spread(per.map((s) => rate(s.controlTop10, s.controlN)))} | ${pct(q.top10, q.n)} | ${pct(q.top5, q.n)} | ${pct(q.controlTop10, q.controlN)} |`);
        json.tables[`${withManual ? "manual" : "auto"}|${scope}|${label}`] = { llmPerRun: per, qloo: q };
      }
      md.push("");
    }
  }

  md.push("## By category (automatic, all festivals, LLM mean of runs)", "", "| Category | Rows | LLM top 10 | Qloo top 10 |", "|---|---|---|---|");
  for (const tag of [...new Set(tested.map((r) => r.tag))]) {
    const rows = tested.filter((r) => r.tag === tag);
    const per = runs.map((run) => llmSummary(run, rows, new Set(), false));
    const q = qlooSummary(rows, new Set());
    md.push(`| ${tag} | ${rows.length} | ${spread(per.map((s) => rate(s.top10, s.n)))} | ${pct(q.top10, q.n)} |`);
  }

  md.push("", "## Memorization check", "", `The model was given only the line-up and the city, and asked which festival it is. It named ${flagged.size} of ${festivals.length} festivals right in at least one run.`, "", "| Festival | Guesses (run: festival, year, confidence) | Flagged |", "|---|---|---|");
  festivals.forEach((festival, index) => {
    const right = (g) => CORE_NAMES[festival.festival].some((n) => key(g.festival).includes(n));
    const guesses = (memo.get(index) ?? []).sort((a, b) => a.run - b.run).map((g) => `${g.run}: ${g.festival}, ${g.year ?? "?"}, ${g.confidence ?? "?"} (${right(g) ? "right" : "wrong"})`).join("; ");
    md.push(`| ${festival.festival} ${festival.year} | ${guesses} | ${flagged.has(index) ? "yes" : "no"} |`);
  });

  md.push("", "## Data health", "", "| Run | Calls | OK | Failed twice | Retried | Attempts cut off | Brands per list | Lists under 10 | Providers | Cost (usage.cost) |", "|---|---|---|---|---|---|---|---|---|---|");
  for (const [run, h] of [...health].sort((a, b) => a[0] - b[0])) {
    md.push(`| ${run} | ${h.calls} | ${h.ok} | ${h.failed} | ${h.retried} | ${h.cut} | ${(h.brands / Math.max(h.lists, 1)).toFixed(2)} | ${h.short.length} | ${[...h.providers].map(([p, c]) => `${p} ${c}`).join(", ")} | $${h.cost.toFixed(4)} |`);
  }
  const shortAll = [...health].flatMap(([run, h]) => h.short.map((line) => `Run ${run}: ${line}`));
  md.push("", shortAll.length ? `Lists with fewer than 10 brands (used as they are): ${shortAll.join("; ")}.` : "Every list had 10 brands.");

  md.push("", "## Limits", "");
  md.push(`- **The model recognized ${flagged.size} of ${festivals.length} festivals** from the line-up and city alone (memorization check above). It may also know their sponsor lists, so this test can favor the model. The subset without recognized festivals is too small to correct for it.`);
  md.push("- Recall of sponsors can happen without naming the festival, so the memorization check does not catch every case.");
  md.push("- The categories are Qloo's own tags (for example White Claw under spirits), which can favor Qloo. The by-category table shows where.");
  md.push("- The sponsor lists in `backtest/festivals.json` are what the partner pages showed and may be incomplete; both sides are scored against the same list.");
  md.push("- These are large festivals; Echolocate is for small events, where no public sponsor lists exist.");
  md.push("- The model lists 10 brands; Qloo ranked up to 50. Only top 10 (and top 5) are compared. Qloo's short lists made some of its top-10 finishes easier; see the \"full lists only\" rows.");
  md.push(`- ${runs.length} runs show the spread between runs; no significance test is done or claimed.`);
  md.push("- One model with one prompt; this says nothing about language models in general.");
  md.push(
    manualReviewed
      ? "- The headline numbers use automatic name matching; the manual check only adds the \"automatic + manually approved\" rows."
      : "- Name matching is automatic only until the manual check is answered.",
  );

  md.push("", "## Lists that failed twice (counted as empty)", "");
  if (emptyLists.length === 0) md.push("None.");
  for (const e of emptyLists) md.push(`- Run ${e.run}, ${e.festival}, ${e.tag}: ${e.error}`);
  md.push("", `## Manual check`, "", `${manual.size} sponsor / answer pairs need a look (section 7), listed in \`manual-check.md\`. ${manualReviewed ? `${decided} answered, ${approved.size} approved as the same brand.` : "Not reviewed yet; every number above uses automatic matching only."}`);

  // Notes on the manual check (doubtful pairs and so on) live in their own
  // file, so a rescore never drops them.
  const notesFile = join(here, "manual-notes.md");
  if (existsSync(notesFile)) md.push("", readFileSync(notesFile, "utf8").trim());

  writeFileSync(join(here, "results.md"), `${md.join("\n")}\n`);
  writeFileSync(join(here, "results.json"), `${JSON.stringify({ ...json, emptyLists, manualPairs: manual.size }, null, 2)}\n`);
  console.log("Saved backtest-llm/results.md and results.json");

  if (manual.size > MANUAL_LIMIT && !WRITE_MANUAL) {
    console.log(`Manual list has ${manual.size} lines (over ${MANUAL_LIMIT}); not writing manual-check.md. Report first, then rerun with --score --write-manual.`);
    return;
  }
  if (manualExists && !WRITE_MANUAL) {
    console.log("manual-check.md already exists; left as it is (--write-manual to rewrite it).");
    return;
  }
  const lines = ["# Manual name check", "", "Mark the last column \"yes\" when the model's answer is the same brand as the sponsor, \"no\" when it is not. Parent and child brands are not the same (METHOD.md section 7).", "", "| # | Sponsor | Qloo name | Model answer | Why listed | Seen in | Same brand? |", "|---|---|---|---|---|---|---|"];
  [...manual.values()].forEach((entry, i) => {
    lines.push(`| ${i + 1} | ${entry.row.sponsor} | ${entry.row.qlooName ?? ""} | ${entry.answer} | ${entry.why} | ${[...entry.seen].slice(0, 4).join("; ")}${entry.seen.size > 4 ? ` (+${entry.seen.size - 4})` : ""} |  |`);
  });
  writeFileSync(join(here, "manual-check.md"), `${lines.join("\n")}\n`);
  console.log(`Saved backtest-llm/manual-check.md (${manual.size} lines)`);
}

// ---------- main ----------

if (!SCORE_ONLY) await makeCalls();
score();
