// GET /api/artists?q=Clairo
// Candidates for one artist name, for the confirmation step in the UI.

import { NextResponse, type NextRequest } from "next/server";
import { publicQlooFailure } from "@/lib/public-errors";
import { searchArtists } from "@/lib/qloo";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!query) {
    return NextResponse.json({ error: "Add ?q=artist name" }, { status: 400 });
  }
  if (query.length > 100) {
    return NextResponse.json({ error: "Artist name is too long" }, { status: 400 });
  }

  try {
    const matches = await searchArtists(query, 5);
    return NextResponse.json({ query, matches });
  } catch (error) {
    return qlooFailure(error);
  }
}

function qlooFailure(error: unknown) {
  // Upstream error text stays in the server log; the browser gets a short message.
  const failure = publicQlooFailure(error, "/api/artists");
  return NextResponse.json({ error: failure.error }, { status: failure.status });
}
