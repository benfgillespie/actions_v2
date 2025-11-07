"use client";

import { LogIn, LogOut } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";

export default function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="pill muted">Loading...</span>;
  }

  if (!session) {
    return (
      <button className="btn ghost" onClick={() => signIn(undefined, { callbackUrl: "/games" })}>
        <LogIn size={16} />
        Sign in
      </button>
    );
  }

  return (
    <div className="user-menu">
      <div className="user-chip">
        <span>{session.user?.name ?? session.user?.email ?? "Player"}</span>
        <span className="subtle">{session.user?.email}</span>
      </div>
      <Link className="btn ghost" href="/games">
        Games
      </Link>
      <button className="btn ghost" onClick={() => signOut({ callbackUrl: "/" })}>
        <LogOut size={16} />
        Sign out
      </button>
    </div>
  );
}
