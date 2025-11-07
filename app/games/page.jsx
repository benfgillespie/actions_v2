import { getServerSession } from "next-auth";
import GameGrid from "@/components/games/GameGrid";
import { games } from "@/lib/games";
import { authOptions } from "@/lib/authOptions";
import { readUserProgress } from "@/lib/progress-store";

const title = "All math games";

async function getProgress(session) {
  if (!session?.user) return {};
  const userId = session.user.id ?? session.user.email;
  if (!userId) return {};
  const data = await readUserProgress(userId);
  return data.games ?? {};
}

export default async function GamesPage() {
  const session = await getServerSession(authOptions);
  const progress = await getProgress(session);

  return (
    <section className="stack">
      <div className="section-header">
        <div>
          <p className="eyebrow">Hub</p>
          <h1>{title}</h1>
          <p>
            Plug in any of the 100 reserved slots with a React component. Sign in
            to track data per user automatically.
          </p>
        </div>
      </div>
      <GameGrid games={games} progress={progress} />
    </section>
  );
}
