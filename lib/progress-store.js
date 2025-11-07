import { kv } from "@vercel/kv";

const memoryStore = new Map();
const KV_AVAILABLE =
  Boolean(process.env.KV_URL) || Boolean(process.env.KV_REST_API_URL);
const KEY_PREFIX = "math-arcade:progress";

const createEmptyProfile = () => ({
  totals: {
    sessionsCompleted: 0,
    questionsAnswered: 0,
    correctAnswers: 0,
    accuracy: 0,
    minutesPlayed: 0,
    gamesTouched: 0,
  },
  games: {},
});

const createEmptyGameStats = () => ({
  attempts: 0,
  questionsAnswered: 0,
  correctAnswers: 0,
  accuracy: 0,
  bestScore: 0,
  bestStreak: 0,
  lastScore: 0,
  totalTimeSeconds: 0,
  lastPlayed: null,
  history: [],
});

const clone = (value) => JSON.parse(JSON.stringify(value));

const keyFor = (userId) => `${KEY_PREFIX}:${userId}`;

async function readRaw(userId) {
  if (!userId) {
    return createEmptyProfile();
  }
  if (KV_AVAILABLE) {
    const stored = await kv.get(keyFor(userId));
    if (stored) {
      return typeof stored === "string" ? JSON.parse(stored) : stored;
    }
    const initial = createEmptyProfile();
    await kv.set(keyFor(userId), JSON.stringify(initial));
    return initial;
  }
  if (!memoryStore.has(userId)) {
    memoryStore.set(userId, createEmptyProfile());
  }
  return memoryStore.get(userId);
}

async function persist(userId, data) {
  if (KV_AVAILABLE) {
    await kv.set(keyFor(userId), JSON.stringify(data));
  } else {
    memoryStore.set(userId, data);
  }
}

function recomputeTotals(progress) {
  const totals = {
    sessionsCompleted: 0,
    questionsAnswered: 0,
    correctAnswers: 0,
    accuracy: 0,
    minutesPlayed: 0,
    gamesTouched: 0,
  };

  Object.values(progress.games).forEach((game) => {
    if (!game.attempts) return;
    totals.sessionsCompleted += game.attempts;
    totals.questionsAnswered += game.questionsAnswered;
    totals.correctAnswers += game.correctAnswers;
    totals.minutesPlayed += game.totalTimeSeconds / 60;
    totals.gamesTouched += 1;
  });

  totals.accuracy =
    totals.questionsAnswered === 0
      ? 0
      : totals.correctAnswers / totals.questionsAnswered;

  progress.totals = totals;
  return progress;
}

export async function readUserProgress(userId) {
  const raw = await readRaw(userId);
  return clone(raw);
}

export async function readGameProgress(userId, gameId) {
  const raw = await readRaw(userId);
  return clone(raw.games[gameId] ?? createEmptyGameStats());
}

export async function recordGameRun(userId, gameId, payload) {
  if (!userId) throw new Error("Missing user id");
  if (!gameId) throw new Error("Missing game id");

  const progress = await readRaw(userId);
  if (!progress.games[gameId]) {
    progress.games[gameId] = createEmptyGameStats();
  }

  const stats = progress.games[gameId];
  const questions = payload.questionsAnswered ?? 0;
  const accuracy = payload.accuracy ?? 0;
  const correctIncrement = Math.round(questions * accuracy);

  stats.attempts += 1;
  stats.questionsAnswered += questions;
  stats.correctAnswers += correctIncrement;
  stats.accuracy =
    stats.questionsAnswered === 0
      ? 0
      : stats.correctAnswers / stats.questionsAnswered;
  stats.bestScore = Math.max(stats.bestScore, payload.score ?? 0);
  stats.bestStreak = Math.max(stats.bestStreak, payload.streak ?? 0);
  stats.lastScore = payload.score ?? stats.lastScore;
  stats.totalTimeSeconds += payload.elapsedSeconds ?? 0;
  stats.lastPlayed = payload.completedAt ?? new Date().toISOString();
  stats.history = [
    {
      score: payload.score ?? 0,
      accuracy: payload.accuracy ?? 0,
      streak: payload.streak ?? 0,
      questions: questions,
      completedAt: stats.lastPlayed,
    },
    ...stats.history,
  ].slice(0, 25);

  recomputeTotals(progress);
  await persist(userId, progress);
  return clone(stats);
}
