"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

export default function useGameProgress(gameId) {
  const { status } = useSession();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    if (status !== "authenticated") {
      setStats(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);

    fetch(`/api/progress?gameId=${gameId}`)
      .then(async (res) => {
        if (!res.ok) {
          const message = await res.text();
          throw new Error(message || "Failed to load progress");
        }
        return res.json();
      })
      .then((payload) => {
        if (active) {
          setStats(payload.stats ?? null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [gameId, status]);

  const recordRun = useCallback(
    async (payload) => {
      if (status !== "authenticated") return;
      const body = {
        ...payload,
        gameId,
        completedAt: payload.completedAt ?? new Date().toISOString(),
      };
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error("Unable to save progress");
      }
      const json = await res.json();
      setStats(json.stats);
    },
    [gameId, status]
  );

  return { stats, loading, error, recordRun };
}
