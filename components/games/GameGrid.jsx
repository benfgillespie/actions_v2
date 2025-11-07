import GameCard from "@/components/games/GameCard";

export default function GameGrid({ games, progress = {} }) {
  return (
    <div className="game-grid">
      {games.map((game) => (
        <GameCard key={game.slug} game={game} progress={progress[game.slug]} />
      ))}
    </div>
  );
}
