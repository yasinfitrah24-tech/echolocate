"use client";

// Pitch email drafting, shared by the brand list and the local places list:
// one open draft at a time per list, keyed by row.

import { useEffect, useRef, useState } from "react";
import { SourceTag } from "./badges";
import { errorNoticeClass, ghostButton } from "./styles";

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

/** Word spellings that plain capitalising gets wrong. */
const MODEL_WORDS: Record<string, string> = { deepseek: "DeepSeek", gpt: "GPT", glm: "GLM", oss: "OSS" };

/**
 * A model id as people read it: "deepseek/deepseek-v4.1-flash" becomes
 * "DeepSeek V4.1 Flash". The id itself is still shown, in small type.
 */
export function modelName(id: string): string {
  const name = (id.split("/").pop() ?? id).replace(/:.*$/, "");
  const words = name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => MODEL_WORDS[word.toLowerCase()] ?? (/^v?\d/i.test(word) ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1)));
  return words.join(" ") || id;
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
      <p role="alert" className={`mt-3 ${errorNoticeClass}`}>
        {error}
      </p>
    );
  }
  if (!pitch) return null;
  return (
    <div className="mt-3 rounded-card border border-l-4 border-line border-l-spot bg-card px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-2">
          {pitch.source === "ai" ? (
            <SourceTag tone="ai">
              Written by AI{pitch.model ? ` (${modelName(pitch.model)})` : ""}
            </SourceTag>
          ) : (
            <SourceTag tone="template">Template draft</SourceTag>
          )}
          {" · edit the parts in [brackets] before sending"}
        </p>
        <button type="button" onClick={onCopy} className={ghostButton}>
          {copied ? "Copied" : "Copy email"}
        </button>
      </div>
      {pitch.source === "ai" && pitch.model && (
        <p className="mt-1 text-[11px] text-ink-3">
          Model id: <code className="font-mono">{pitch.model}</code>
        </p>
      )}
      {pitch.note && <p className="mt-2 text-xs text-ink-2">{pitch.note}</p>}
      <p className="mt-3 font-bold">{pitch.subject}</p>
      <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-wrap">{pitch.body}</p>
    </div>
  );
}
