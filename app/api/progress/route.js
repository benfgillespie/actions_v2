import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import {
  readGameProgress,
  readUserProgress,
  recordGameRun,
} from "@/lib/progress-store";

function ensureUserId(session) {
  return session?.user?.id ?? session?.user?.email ?? null;
}

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = ensureUserId(session);
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get("gameId");
  const summary = searchParams.get("summary");

  if (gameId) {
    const stats = await readGameProgress(userId, gameId);
    return NextResponse.json({ stats });
  }

  const progress = await readUserProgress(userId);
  if (summary) {
    return NextResponse.json({ summary: progress });
  }
  return NextResponse.json(progress);
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = ensureUserId(session);
  const body = await request.json();
  const { gameId, ...run } = body;

  if (!gameId) {
    return NextResponse.json(
      { error: "Missing game identifier" },
      { status: 400 }
    );
  }

  const stats = await recordGameRun(userId, gameId, run);
  return NextResponse.json({ stats });
}
