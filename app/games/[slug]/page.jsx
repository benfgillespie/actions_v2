import { notFound } from "next/navigation";
import Link from "next/link";
import GameClient from "@/components/games/GameClient";
import { games, getGameBySlug } from "@/lib/games";

export function generateStaticParams() {
  return games.map((game) => ({ slug: game.slug }));
}

export default function GamePage({ params }) {
  const game = getGameBySlug(params.slug);
  if (!game) {
    notFound();
  }

  return (
    <section className="stack">
      <div className="section-header">
        <div>
          <p className="eyebrow">{game.subject}</p>
          <h1>{game.title}</h1>
          <p>{game.summary}</p>
          <div className="pill muted">
            Estimated {game.estimatedMinutes} min • Difficulty {game.difficulty}/4
          </div>
        </div>
        <Link className="btn secondary" href="/games">
          Back to games
        </Link>
      </div>
      <GameClient game={game} />
    </section>
  );
}
