export default function GameStatsPanel({ stats, loading }) {
  if (loading) {
    return (
      <div className="stats-panel">
        <p>Loading progress...</p>
      </div>
    );
  }

  if (!stats || !stats.attempts) {
    return (
      <div className="stats-panel">
        <h4>No runs yet</h4>
        <p>Play once to start building your mastery graph.</p>
      </div>
    );
  }

  return (
    <div className="stats-panel">
      <div>
        <span className="label">Sessions</span>
        <strong>{stats.attempts}</strong>
      </div>
      <div>
        <span className="label">Accuracy</span>
        <strong>{Math.round((stats.accuracy ?? 0) * 100)}%</strong>
      </div>
      <div>
        <span className="label">Best streak</span>
        <strong>{stats.bestStreak}</strong>
      </div>
      <div>
        <span className="label">Best score</span>
        <strong>{stats.bestScore}</strong>
      </div>
    </div>
  );
}
