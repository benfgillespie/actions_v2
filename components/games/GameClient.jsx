"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { signIn, useSession } from "next-auth/react";
import GameStatsPanel from "@/components/games/GameStatsPanel";
import ComingSoonMessage from "@/components/games/ComingSoonMessage";
import useGameProgress from "@/hooks/useGameProgress";

export default function GameClient({ game }) {
  const { status } = useSession();
  const { stats, loading, recordRun } = useGameProgress(game.slug);

  const GameImpl = useMemo(() => {
    if (!game.loader) return null;
    return dynamic(game.loader, { ssr: false });
  }, [game.loader]);

  if (!game.loader) {
    return <ComingSoonMessage game={game} />;
  }

  if (status === "loading") {
    return (
      <div className="auth-guard">
        <p>Loading your session...</p>
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="auth-guard">
        <p>Sign in to sync your progress before jumping into {game.title}.</p>
        <button
          className="btn primary"
          onClick={() => signIn(undefined, { callbackUrl: `/games/${game.slug}` })}
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="game-shell">
      <GameStatsPanel stats={stats} loading={loading} />
      {GameImpl ? (
        <GameImpl onProgress={recordRun} />
      ) : (
        <p>Unable to load this game.</p>
      )}
    </div>
  );
}
