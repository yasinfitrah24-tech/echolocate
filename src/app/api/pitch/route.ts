// POST /api/pitch
// Body (JSON):
//   brand: { name: string; categoryLabel: string; reasonText: string }   one brand from /api/brands
//   artists?: string[]            line-up names
//   event?: { name?, city?, crowdSize?, age?, genre?, organizer? }
//
// Returns { subject, body, source: "deepseek" | "template", model, note, ms }.

import { NextResponse } from "next/server";
import { writePitch } from "@/lib/pitch";
import { AGE_GROUPS, type AgeGroup } from "@/lib/qloo";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > 0 && text.length <= maxLength ? text : null;
}

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("Body must be JSON");
  }
  if (!isRecord(body)) return bad("Body must be a JSON object");

  if (!isRecord(body.brand)) return bad("brand is required");
  const name = cleanText(body.brand.name, 100);
  const categoryLabel = cleanText(body.brand.categoryLabel, 60);
  const reasonText = cleanText(body.brand.reasonText, 300);
  if (!name || !categoryLabel || !reasonText) {
    return bad("brand needs name, categoryLabel and reasonText");
  }

  const artists: string[] = [];
  if (body.artists !== undefined) {
    if (!Array.isArray(body.artists)) return bad("artists must be a list of names");
    for (const item of body.artists.slice(0, 5)) {
      const artist = cleanText(item, 100);
      if (artist) artists.push(artist);
    }
  }

  const event = isRecord(body.event) ? body.event : {};

  let crowdSize: number | null = null;
  if (event.crowdSize !== undefined && event.crowdSize !== null && event.crowdSize !== "") {
    const value = Number(event.crowdSize);
    if (!Number.isInteger(value) || value < 1 || value > 1_000_000) {
      return bad("event.crowdSize must be a whole number of people");
    }
    crowdSize = value;
  }

  let age: AgeGroup | null = null;
  if (event.age !== undefined && event.age !== null && event.age !== "") {
    const match = AGE_GROUPS.find((group) => group === event.age);
    if (!match) return bad(`event.age must be one of: ${AGE_GROUPS.join(", ")}`);
    age = match;
  }

  const draft = await writePitch({
    brand: { name, categoryLabel, reasonText },
    artists,
    genre: cleanText(event.genre, 60),
    eventName: cleanText(event.name, 100),
    city: cleanText(event.city, 100),
    crowdSize,
    age,
    organizer: cleanText(event.organizer, 100),
  });

  return NextResponse.json(draft);
}
