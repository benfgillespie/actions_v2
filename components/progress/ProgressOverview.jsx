import Link from "next/link";

export default function ProgressOverview({ progress, isAuthenticated }) {
  if (!isAuthenticated) {
    return (
      <div className="coming-soon">
        <p>Sign in to see real-time mastery maps fed by your Vercel KV data.</p>
        <Link className="btn primary" href="/signin">
          Sign in
        </Link>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="coming-soon">
        <p>We had trouble loading your data. Refresh or try again in a moment.</p>
      </div>
    );
  }

  const totals = progress.totals ?? {};
  const games = progress.games ?? {};
  const topGames = Object.entries(games)
    .filter(([, stats]) => stats.attempts > 0)
    .sort(([, a], [, b]) => (b.bestScore ?? 0) - (a.bestScore ?? 0))
    .slice(0, 4);

  return (
    <div className="progress-overview">
      <div className="totals">
        <Metric label="Sessions" value={totals.sessionsCompleted ?? 0} />
        <Metric
          label="Accuracy"
          value={`${Math.round((totals.accuracy ?? 0) * 100)}%`}
        />
        <Metric label="Games played" value={totals.gamesTouched ?? 0} />
        <Metric
          label="Minutes"
          value={Math.round(totals.minutesPlayed ?? 0)}
        />
      </div>
      <div className="top-games">
        <h4>Recent highlights</h4>
        {topGames.length === 0 ? (
          <p>Play any game to start building streaks.</p>
        ) : (
          <ul>
            {topGames.map(([slug, stats]) => (
              <li key={slug}>
                <span>{slug.replace(/-/g, " ")}</span>
                <span>{Math.round((stats.accuracy ?? 0) * 100)}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <span className="label">{label}</span>
      <h3>{value}</h3>
    </div>
  );
}
