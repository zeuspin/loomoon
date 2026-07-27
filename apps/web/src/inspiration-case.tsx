import { useEffect, useMemo, useState } from "react";
import type { DeferredIntent } from "./deferred-intent.js";
import { buildRemixIntent, nextReplayStep } from "./home-state.js";
import type { InspirationCase } from "./mock-content.js";

export function InspirationCaseOverlay({
  item,
  onClose,
  onProtected,
  onRemix,
}: {
  item: InspirationCase;
  onClose: () => void;
  onProtected: (intent: DeferredIntent, action: () => void) => void;
  onRemix: (item: InspirationCase) => void;
}) {
  const [resultId, setResultId] = useState(item.results[0]?.id ?? "");
  const [replaying, setReplaying] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const result = useMemo(
    () => item.results.find((candidate) => candidate.id === resultId),
    [item.results, resultId],
  );
  const step = item.replaySteps[stepIndex];

  useEffect(() => {
    if (!replaying || item.replaySteps.length <= 1) return;
    const timer = window.setInterval(() => {
      setStepIndex((current) => {
        const next = nextReplayStep(current, item.replaySteps.length);
        const nextStep = item.replaySteps[next];
        if (nextStep) setResultId(nextStep.resultId);
        if (next === item.replaySteps.length - 1) setReplaying(false);
        return next;
      });
    }, 1400);
    return () => window.clearInterval(timer);
  }, [item.replaySteps, replaying]);

  return (
    <div className="lm-case-overlay" role="dialog" aria-modal="true">
      <button aria-label="关闭作品详情" className="lm-case-close" onClick={onClose}>
        ×
      </button>
      <header>
        <h2>{item.title}</h2>
        <div>
          <button
            onClick={() => {
              setStepIndex(0);
              const first = item.replaySteps[0];
              if (first) setResultId(first.resultId);
              setReplaying(true);
            }}
          >
            {replaying ? "回放中…" : "查看回放"}
          </button>
          <button
            className="lm-case-remix"
            onClick={() =>
              onProtected(buildRemixIntent(item), () => onRemix(item))
            }
          >
            做同款
          </button>
        </div>
      </header>
      <div className="lm-case-layout">
        <aside className="lm-case-thumbnails">
          {item.results.map((candidate) => (
            <button
              className={candidate.id === resultId ? "is-active" : ""}
              key={candidate.id}
              onClick={() => {
                setReplaying(false);
                setResultId(candidate.id);
              }}
            >
              <img alt={candidate.name} src={candidate.imageUrl} />
            </button>
          ))}
        </aside>
        <main className="lm-case-preview">
          {result && <img alt={result.name} src={result.imageUrl} />}
        </main>
        <aside className="lm-case-info">
          <div className="lm-case-author">
            <img alt="" src={item.author.avatarUrl} />
            <strong>{item.author.name}</strong>
            <span>◉ {item.views.toLocaleString()}</span>
            <span>♥ {item.likes}</span>
          </div>
          <p className="lm-case-prompt">{item.prompt}</p>
          <small>◉ {item.model}</small>
          <h3>{result?.name}</h3>
          {result && <img alt="" src={result.imageUrl} />}
          {step && (
            <div className="lm-case-replay-step">
              <b>{step.title}</b>
              <p>{step.description}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
