import Link from "next/link";
import { Trophy, Activity, Shield } from "lucide-react";

const highlights = [
  {
    icon: Trophy,
    title: "100 skill paths",
    copy: "Mix and match math strands with adaptive difficulty that tracks mastery.",
  },
  {
    icon: Activity,
    title: "Cross-game insights",
    copy: "Progress maps show how growth in one game unlocks the next.",
  },
  {
    icon: Shield,
    title: "Secure accounts",
    copy: "Auth.js + Vercel KV keep student stats synced between devices.",
  },
];

export default function HeroSection() {
  return (
    <section className="hero">
      <div>
        <p className="eyebrow">MathArcade Platform</p>
        <h1>Host 100 connected math games with persistent progress.</h1>
        <p className="lead">
          Drop in new experiences, monitor accuracy trends, and let students seamlessly
          continue where they left off on any device.
        </p>
        <div className="cta-row">
          <Link className="btn primary" href="/games">
            Explore the games
          </Link>
          <Link className="btn secondary" href="/signin">
            Sign in
          </Link>
        </div>
      </div>
      <div className="hero-grid">
        {highlights.map((item) => (
          <div key={item.title} className="hero-card">
            <item.icon size={24} />
            <h3>{item.title}</h3>
            <p>{item.copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
