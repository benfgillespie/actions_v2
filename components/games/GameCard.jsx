import Link from "next/link";

export default function GameCard({ game, progress }) {
  const percent = Math.round((progress?.accuracy ?? 0) * 100);
  const attempts = progress?.attempts ?? 0;

  return (
    <Link href={`/games/${game.slug}`} className="game-card">
      <div className="game-card__meta">
        <p className="eyebrow">{game.subject}</p>
        <span className={`status ${game.status}`}>{game.status}</span>
      </div>
      <h3>{game.title}</h3>
      <p>{game.summary}</p>
      <div className="game-card__stats">
        <div>
          <span className="label">Difficulty</span>
          <span>{"★".repeat(game.difficulty)}</span>
        </div>
        <div>
          <span className="label">Accuracy</span>
          <span>{percent}%</span>
        </div>
        <div>
          <span className="label">Sessions</span>
          <span>{attempts}</span>
        </div>
      </div>
    </Link>
  );
}
