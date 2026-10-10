// GET /api/artists?q=Clairo
// Candidates for one artist name, for the confirmation step in the UI.

import { NextResponse, type NextRequest } from "next/server";
import { QlooError, searchArtists } from "@/lib/qloo";

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
  if (error instanceof QlooError) {
    if (error.status === 429) {
      return NextResponse.json(
        { error: "Qloo is busy right now. Try again in a few seconds." },
        { status: 503 },
      );
    }
    // Upstream error text stays in the server log; the browser gets a short message.
    console.error(error.message);
    const message = error.status ? `Qloo request failed (status ${error.status})` : error.message;
    return NextResponse.json({ error: message }, { status: error.status ? 502 : 500 });
  }
  console.error(error);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
