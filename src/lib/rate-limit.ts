// Limits for the public demo, so other people's searches cannot use up the
// Qloo quota. Server only.
//
// - Per IP: live searches per 10 minutes and per day (pitches too, they use DeepSeek).
// - Per day: at most DAILY_LIVE_CALLS live Qloo calls.
// - QLOO_LIVE=off (env var, e.g. in Vercel) pauses live searches; the saved
//   example keeps working.
// The saved example searches never count.
//
// Counts live in memory, so on Vercel each server instance keeps its own.
// Good enough for a demo; a shared limit would need a store like Redis.

import { NextResponse } from "next/server";
import { LIVE_PAUSED } from "@/lib/public-errors";
import { liveCallsToday } from "@/lib/qloo";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export const DAILY_LIVE_CALLS = 600;

// Loose enough that a judge can test freely: the rules ask for the demo to be
// usable without restriction, and Qloo confirmed (Devpost forum, 26 Oct) that
// hackathon requests are free through judging. DAILY_LIVE_CALLS still guards
// the key's quota against runaway traffic.
const LIMITS = {
  // One search = /api/brands; the map's /api/places call follows each one.
  search: [
    { max: 15, windowMs: 10 * MINUTE },
    { max: 60, windowMs: DAY },
  ],
  places: [
    { max: 30, windowMs: 10 * MINUTE },
    { max: 120, windowMs: DAY },
  ],
  pitch: [{ max: 20, windowMs: 10 * MINUTE }],
} as const;

type Bucket = keyof typeof LIMITS;

/** Request times per bucket and IP, newest last. */
const hits = new Map<string, number[]>();

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

/** Counts this request if it fits; otherwise says how long to wait. */
function take(bucket: Bucket, ip: string): { ok: true } | { ok: false; waitMs: number; daily: boolean } {
  const now = Date.now();
  const key = `${bucket}:${ip}`;
  const times = (hits.get(key) ?? []).filter((time) => now - time < DAY);
  for (const limit of LIMITS[bucket]) {
    const inWindow = times.filter((time) => now - time < limit.windowMs);
    if (inWindow.length >= limit.max) {
      hits.set(key, times);
      return { ok: false, waitMs: inWindow[0] + limit.windowMs - now, daily: limit.windowMs === DAY };
    }
  }
  times.push(now);
  hits.set(key, times);
  if (hits.size > 5000) prune(now);
  return { ok: true };
}

function prune(now: number): void {
  for (const [key, times] of hits) {
    if (times.every((time) => now - time >= DAY)) hits.delete(key);
  }
}

function minutes(ms: number): string {
  const count = Math.max(1, Math.ceil(ms / MINUTE));
  return count === 1 ? "a minute" : `${count} minutes`;
}

function refuse(message: string, status: number, waitMs?: number): NextResponse {
  const headers = waitMs ? { "Retry-After": String(Math.ceil(waitMs / 1000)) } : undefined;
  return NextResponse.json({ error: message, limited: true }, { status, headers });
}

/** Null when this live Qloo search may run; otherwise the response to send. */
export function blockLiveSearch(request: Request, bucket: "search" | "places"): NextResponse | null {
  if (process.env.QLOO_LIVE === "off") {
    return refuse(LIVE_PAUSED, 503);
  }
  if (liveCallsToday() >= DAILY_LIVE_CALLS) {
    return refuse(
      "The live demo has used today's Qloo budget. Use Try an example, or run Echolocate locally with your own Qloo key.",
      503,
    );
  }
  const result = take(bucket, clientIp(request));
  if (result.ok) return null;
  return result.daily
    ? refuse("You have reached today's limit of live searches on this demo. Use Try an example, or come back tomorrow.", 429, result.waitMs)
    : refuse(
        `You have run several live searches in a row. Try again in about ${minutes(result.waitMs)}, or use Try an example. It is instant.`,
        429,
        result.waitMs,
      );
}

/** Null when this pitch may be drafted; otherwise the response to send. */
export function blockPitch(request: Request): NextResponse | null {
  const result = take("pitch", clientIp(request));
  if (result.ok) return null;
  return refuse(
    `You have drafted several pitches in a row. Try again in about ${minutes(result.waitMs)}.`,
    429,
    result.waitMs,
  );
}
