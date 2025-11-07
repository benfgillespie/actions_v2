"use client";

import { Github } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function SignInCard() {
  return (
    <div className="auth-card">
      <div>
        <p className="eyebrow">Math Mastery Hub</p>
        <h1>Sign in to unlock your games</h1>
        <p>
          We use GitHub for authentication today. Add any other provider in{" "}
          <code>lib/authOptions.js</code> when you wire in Auth.js.
        </p>
      </div>
      <button
        className="btn primary"
        onClick={() => signIn("github", { callbackUrl: "/games" })}
      >
        <Github size={18} />
        Continue with GitHub
      </button>
      <p className="hint">
        Don&apos;t have a GitHub account?{" "}
        <Link href="https://github.com/signup" target="_blank" rel="noreferrer">
          Create one in a minute
        </Link>
        .
      </p>
    </div>
  );
}
