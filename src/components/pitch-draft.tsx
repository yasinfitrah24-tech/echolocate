"use client";

// Pitch email drafting, shared by the brand list and the local places list:
// one open draft at a time per list, keyed by row.

import { useEffect, useRef, useState } from "react";

export interface PitchResponse {
  subject: string;
  body: string;
  source: "ai" | "template";
  model: string | null;
  note: string | null;
}

/** The facts /api/pitch needs about the event, from the search the list came from. */
export interface PitchContext {
  artists: string[];
  event: {
    name?: string;
    city?: string;
    crowdSize?: string;
    age?: string;
    admission?: string;
    genre?: string;
  };
}

export interface PitchTarget {
  name: string;
  categoryLabel: string;
  reasonText: string;
  kind: "brand" | "place";
  /** For a place Qloo has little taste data for: its distance, km. */
  nearbyKm?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPitchResponse(value: unknown): value is PitchResponse {
  return isRecord(value) && typeof value.subject === "string" && typeof value.body === "string";
}

export function usePitch() {
  const [pitchFor, setPitchFor] = useState<string | null>(null);
  // The request in flight: the row it is for plus its number. Only this one may
  // fill the box, so a slow answer for an earlier row is dropped.
  const [writing, setWriting] = useState<{ key: string; id: number } | null>(null);
  const [pitch, setPitch] = useState<PitchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const lastId = useRef(0);
  const controller = useRef<AbortController | null>(null);

  // A list that goes away (new search) cancels its request.
  useEffect(() => () => controller.current?.abort(), []);

  async function draft(key: string, target: PitchTarget, context: PitchContext) {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const id = ++lastId.current;
    const isCurrent = () => lastId.current === id;

    setPitchFor(key);
    setPitch(null);
    setError(null);
    setWriting({ key, id });
    setCopied(false);
    try {
      const response = await fetch("/api/pitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: target, artists: context.artists, event: context.event }),
        signal: abort.signal,
      });
      const data: unknown = await response.json();
      if (!isCurrent()) return;
      if (!response.ok || !isPitchResponse(data)) {
        setError(isRecord(data) && typeof data.error === "string" ? data.error : "Could not write the pitch. Try again.");
        return;
      }
      setPitch(data);
    } catch {
      // Aborted because another row was clicked, or the answer is for an old row.
      if (!isCurrent()) return;
      setError("Could not reach the server. Try again.");
    } finally {
      // Always ends this request's "Writing…", never a newer one's.
      setWriting((current) => (current?.id === id ? null : current));
      if (controller.current === abort) controller.current = null;
    }
  }

  async function copy() {
    if (!pitch) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${pitch.subject}\n\n${pitch.body}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function reset() {
    controller.current?.abort();
    lastId.current += 1;
    setWriting(null);
    setPitchFor(null);
    setPitch(null);
    setError(null);
  }

  /** True while the pitch for this row is being written. */
  function isWriting(key: string): boolean {
    return writing?.key === key;
  }

  return { pitchFor, isWriting, pitch, error, copied, draft, copy, reset };
}

/** The error or the finished draft, shown under the row it belongs to. */
export function PitchBox({
  pitch,
  error,
  copied,
  onCopy,
}: {
  pitch: PitchResponse | null;
  error: string | null;
  copied: boolean;
  onCopy: () => void;
}) {
  if (error) {
    return (
      <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
        {error}
      </p>
    );
  }
  if (!pitch) return null;
  return (
    <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">
          {pitch.source === "ai" ? `Written by AI (${pitch.model})` : "Template draft"}
          {" · edit the parts in [brackets] before sending"}
        </p>
        <button
          type="button"
          onClick={onCopy}
          className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-zinc-100"
        >
          {copied ? "Copied" : "Copy email"}
        </button>
      </div>
      {pitch.note && <p className="mt-2 text-xs text-zinc-600">{pitch.note}</p>}
      <p className="mt-3 text-sm font-semibold">{pitch.subject}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-800">{pitch.body}</p>
    </div>
  );
}
