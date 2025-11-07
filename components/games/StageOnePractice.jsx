"use client";

import { useEffect, useMemo, useState } from "react";
import stage1Topics from "@/lib/stage1Topics";

const WRONG_STREAK_TRIGGER = 3;
const createStats = () => ({ correct: 0, total: 0, streak: 0, wrongStreak: 0 });

export default function StageOnePractice({ onProgress }) {
  const playableTopics = useMemo(
    () => stage1Topics.filter((topic) => !topic.requiresAssets),
    []
  );

  const [currentTopic, setCurrentTopic] = useState(playableTopics[0] ?? null);
  const [question, setQuestion] = useState(() =>
    playableTopics[0]?.generateQuestion()
  );
  const [inputValue, setInputValue] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [stats, setStats] = useState(() => createStats());
  const [sessionStart, setSessionStart] = useState(() => Date.now());

  useEffect(() => {
    if (!currentTopic) return;
    setQuestion(currentTopic.generateQuestion());
    setFeedback(null);
    setInputValue("");
    setStats(createStats());
    setSessionStart(Date.now());
  }, [currentTopic]);

  const struggling = stats.wrongStreak >= WRONG_STREAK_TRIGGER;

  if (!currentTopic) {
    return (
      <div className="coming-soon">
        <p>
          Stage 1 topics require bespoke assets before they can run in this
          workspace. See <code>docs/image-dependent-topics.md</code>.
        </p>
      </div>
    );
  }

  const recordProgress = (nextStats, topicSlug) => {
    if (!onProgress) return;
    const payload = {
      score: nextStats.correct,
      questionsAnswered: nextStats.total,
      accuracy:
        nextStats.total === 0 ? 0 : nextStats.correct / nextStats.total,
      streak: nextStats.streak,
      elapsedSeconds: Math.max(
        1,
        Math.round((Date.now() - sessionStart) / 1000)
      ),
      completedAt: new Date().toISOString(),
      metadata: { stage: 1, topic: topicSlug },
    };
    const maybePromise = onProgress(payload);
    if (maybePromise?.catch) {
      maybePromise.catch(() => {});
    }
  };

  const applyResult = (result) => {
    if (!question || feedback) return;
    const nextStats = {
      total: stats.total + 1,
      correct: stats.correct + (result.correct ? 1 : 0),
      streak: result.correct ? stats.streak + 1 : 0,
      wrongStreak: result.correct ? 0 : stats.wrongStreak + 1,
    };
    setStats(nextStats);
    setFeedback(result);
    recordProgress(nextStats, currentTopic.slug);
  };

  const handleMultipleChoice = (choiceId) => {
    if (!question || feedback) return;
    const outcome = question.evaluate(choiceId);
    applyResult(outcome);
  };

  const handleInputSubmit = () => {
    if (!question || feedback) return;
    if (!inputValue.trim()) return;
    const outcome = question.evaluate(inputValue);
    applyResult(outcome);
  };

  const handleNextQuestion = () => {
    if (!currentTopic) return;
    setQuestion(currentTopic.generateQuestion());
    setFeedback(null);
    setInputValue("");
  };

  return (
    <div className="stage-layout">
      <aside className="topic-nav">
        <p className="eyebrow">Stage 1 topics</p>
        {playableTopics.map((topic) => (
          <button
            key={topic.slug}
            className={`topic-button ${
              topic.slug === currentTopic.slug ? "active" : ""
            }`}
            onClick={() => setCurrentTopic(topic)}
          >
            <strong>{topic.title}</strong>
            <span>{topic.description}</span>
          </button>
        ))}
        <p className="helper-note">
          Need pictograms? They&apos;re logged in{" "}
          <code>docs/image-dependent-topics.md</code>.
        </p>
      </aside>

      <section className="practice-area">
        <div className={`helper-card ${struggling ? "struggling" : ""}`}>
          <div>
            <p className="eyebrow">{currentTopic.title}</p>
            <h3>{currentTopic.description}</h3>
            {struggling ? (
              <p className="hint">
                You&apos;ve missed {stats.wrongStreak} in a row. Watch the helper
                video before trying again.
              </p>
            ) : (
              <p className="hint">
                Use the helper link whenever you want a quick refresher.
              </p>
            )}
          </div>
          <a
            className={`btn secondary ${struggling ? "highlight" : ""}`}
            href={currentTopic.helperLink}
            target="_blank"
            rel="noreferrer"
          >
            Watch helper video
          </a>
        </div>

        <div className="stats-panel compact">
          <div>
            <span className="label">Correct</span>
            <strong>{stats.correct}</strong>
          </div>
          <div>
            <span className="label">Attempted</span>
            <strong>{stats.total}</strong>
          </div>
          <div>
            <span className="label">Accuracy</span>
            <strong>
              {stats.total === 0
                ? "—"
                : `${Math.round((stats.correct / stats.total) * 100)}%`}
            </strong>
          </div>
          <div>
            <span className="label">Streak</span>
            <strong>{stats.streak}</strong>
          </div>
        </div>

        <div className="question-card">
          <p className="eyebrow">Question</p>
          <h2>{question?.prompt}</h2>

          {question?.type === "multiple" && (
            <div className="choice-grid">
              {question.choices.map((choice) => {
                const isCorrectChoice =
                  feedback && choice.id === question.correctChoiceId;
                return (
                  <button
                    key={choice.id}
                    className={`choice-btn ${
                      isCorrectChoice ? "choice-btn--correct" : ""
                    }`}
                    onClick={() => handleMultipleChoice(choice.id)}
                    disabled={Boolean(feedback)}
                  >
                    {choice.label}
                  </button>
                );
              })}
            </div>
          )}

          {question?.type === "input" && (
            <div className="input-row">
              <input
                type="text"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder={question.placeholder ?? "Type your answer"}
                disabled={Boolean(feedback)}
              />
              <button
                className="btn primary"
                onClick={handleInputSubmit}
                disabled={Boolean(feedback) || !inputValue.trim()}
              >
                Check answer
              </button>
            </div>
          )}

          {feedback && (
            <div
              className={`feedback ${
                feedback.correct ? "feedback--success" : "feedback--error"
              }`}
            >
              <p>{feedback.correct ? "Correct!" : "Keep trying."}</p>
              {!feedback.correct && (
                <p>
                  Correct answer:{" "}
                  <span className="feedback__answer">
                    {feedback.correctAnswer}
                  </span>
                </p>
              )}
              {feedback.explanation && (
                <p className="hint">{feedback.explanation}</p>
              )}
            </div>
          )}

          {feedback && (
            <button className="btn secondary next-btn" onClick={handleNextQuestion}>
              Next question
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
