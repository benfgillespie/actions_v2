import Link from "next/link";
import UserMenu from "@/components/auth/UserMenu";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="logo">
        <span>Math</span>Arcade
      </Link>
      <nav className="nav-links">
        <Link href="/games">Games</Link>
        <Link href="/#progress">Progress</Link>
      </nav>
      <UserMenu />
    </header>
  );
}
