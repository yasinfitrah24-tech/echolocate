"use client";

// Pitch email drafting, shared by the brand list and the local places list:
// one open draft at a time per list, keyed by row.

import { useState } from "react";

export interface PitchResponse {
  subject: string;
  body: string;
  source: "deepseek" | "template";
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
}

export function usePitch() {
  const [pitchFor, setPitchFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pitch, setPitch] = useState<PitchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function draft(key: string, target: PitchTarget, context: PitchContext) {
    setPitchFor(key);
    setPitch(null);
    setError(null);
    setLoading(true);
    setCopied(false);
    try {
      const response = await fetch("/api/pitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: target, artists: context.artists, event: context.event }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not write the pitch");
        return;
      }
      setPitch(data as PitchResponse);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
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
    setPitchFor(null);
    setPitch(null);
    setError(null);
  }

  return { pitchFor, loading, pitch, error, copied, draft, copy, reset };
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
          {pitch.source === "deepseek" ? "Written by DeepSeek" : "Template draft"}
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
      <p className="mt-3 text-sm font-semibold">{pitch.subject}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-800">{pitch.body}</p>
      {pitch.note && <p className="mt-3 text-xs text-zinc-500">{pitch.note}</p>}
    </div>
  );
}
