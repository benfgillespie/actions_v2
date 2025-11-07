export default function ComingSoonMessage({ game }) {
  return (
    <div className="coming-soon">
      <h3>{game.title} is almost here</h3>
      <p>
        We scaffolded this slot so you can drop in a new React mini-game component and automatically
        wire it into authentication + progress tracking. Update <code>lib/games.js</code> with a{" "}
        <code>loader</code> function to make it live.
      </p>
    </div>
  );
}
