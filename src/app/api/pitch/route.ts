// POST /api/pitch
// Body (JSON):
//   brand: { name, categoryLabel, reasonText, kind?: "brand" | "place", nearbyKm? }
//          one brand from /api/brands, or one place from /api/places (kind "place").
//          nearbyKm: only for a place with little taste data; the pitch then
//          pitches being nearby and makes no taste claim.
//   artists?: string[]            line-up names
//   event?: { name?, city?, crowdSize?, age?, admission?, genre?, organizer? }
//
// Returns { subject, body, source: "deepseek" | "template", model, note, ms }.

import { NextResponse } from "next/server";
import { writePitch } from "@/lib/pitch";
import { blockPitch } from "@/lib/rate-limit";
import {
  ADMISSIONS,
  AUDIENCE_AGES,
  findAdmission,
  findAudienceAge,
  type Admission,
  type AudienceAge,
} from "@/lib/audience";

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
  const blocked = blockPitch(request);
  if (blocked) return blocked;

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
  const kind = body.brand.kind ?? "brand";
  if (kind !== "brand" && kind !== "place") return bad('brand.kind must be "brand" or "place"');
  let nearbyKm: number | null = null;
  if (body.brand.nearbyKm !== undefined && body.brand.nearbyKm !== null) {
    const value = Number(body.brand.nearbyKm);
    if (kind !== "place" || !Number.isFinite(value) || value < 0 || value > 100) {
      return bad("brand.nearbyKm must be a distance in km, for a place only");
    }
    nearbyKm = value;
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

  let age: AudienceAge | null = null;
  if (event.age !== undefined && event.age !== null && event.age !== "") {
    age = findAudienceAge(event.age);
    if (!age) {
      return bad(`event.age must be one of: ${AUDIENCE_AGES.map((option) => option.id).join(", ")}`);
    }
  }

  let admission: Admission | null = null;
  if (event.admission !== undefined && event.admission !== null && event.admission !== "") {
    admission = findAdmission(event.admission);
    if (!admission) {
      return bad(`event.admission must be one of: ${ADMISSIONS.map((option) => option.id).join(", ")}`);
    }
  }

  const draft = await writePitch({
    brand: { name, categoryLabel, reasonText, kind, nearbyKm },
    artists,
    genre: cleanText(event.genre, 60),
    eventName: cleanText(event.name, 100),
    city: cleanText(event.city, 100),
    crowdSize,
    age,
    admission,
    organizer: cleanText(event.organizer, 100),
  });

  return NextResponse.json(draft);
}
