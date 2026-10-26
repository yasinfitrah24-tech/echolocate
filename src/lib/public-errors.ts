// The only error texts the browser sees for Qloo trouble. Short and friendly;
// the full upstream message goes to the server log, never to the page.
// Server only.

import { QlooError } from "./qloo";

export const LIVE_PAUSED = "Live search is paused right now. Use Try an example.";
const QLOO_BUSY = "Qloo is busy right now. Your event details are kept. Try again in a minute, or use Try an example.";
const QLOO_DOWN = "Qloo didn't answer in time. Your event details are kept. Try again in a minute, or use Try an example.";
const UNKNOWN = "Something went wrong. Try again, or use Try an example.";

/** Logs the real error and returns what the browser may see. */
export function publicQlooFailure(error: unknown, where: string): { status: number; error: string } {
  console.error(`${where}: ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof QlooError) {
    if (error.kind === "no_key") return { status: 503, error: LIVE_PAUSED };
    if (error.status === 429) return { status: 503, error: QLOO_BUSY };
    return { status: 502, error: QLOO_DOWN };
  }
  return { status: 500, error: UNKNOWN };
}
