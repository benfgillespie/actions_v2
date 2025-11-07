import { getServerSession } from "next-auth";
import HeroSection from "@/components/marketing/HeroSection";
import GameGrid from "@/components/games/GameGrid";
import ProgressOverview from "@/components/progress/ProgressOverview";
import { authOptions } from "@/lib/authOptions";
import { readUserProgress } from "@/lib/progress-store";
import { getFeaturedGames } from "@/lib/games";

const featuredGames = getFeaturedGames();

async function getProgress(session) {
  if (!session?.user) return null;
  const userId = session.user.id ?? session.user.email;
  if (!userId) return null;
  return readUserProgress(userId);
}

export default async function Page() {
  const session = await getServerSession(authOptions);
  const progress = await getProgress(session);

  return (
    <>
      <HeroSection />
      <section id="progress" className="stack">
        <div className="section-header">
          <div>
            <p className="eyebrow">Cross-game insights</p>
            <h2>Map growth across strands</h2>
          </div>
        </div>
        <ProgressOverview progress={progress} isAuthenticated={Boolean(session)} />
      </section>
      <section className="stack">
        <div className="section-header">
          <div>
            <p className="eyebrow">Launch-ready</p>
            <h2>Featured math games</h2>
          </div>
        </div>
        <GameGrid games={featuredGames} progress={progress?.games ?? {}} />
      </section>
    </>
  );
}
