import type { SummaryResult } from "../types";

interface Props {
  result: SummaryResult | null;
  loading: boolean;
  hasRepo: boolean;
  onGenerate: () => void;
}

export function SummaryTab({ result, loading, hasRepo, onGenerate }: Props) {
  if (!hasRepo) return <div className="status empty">Pick a repo folder to generate a summary.</div>;

  if (!loading && !result) {
    return (
      <div className="generate-prompt">
        <button onClick={onGenerate}>Generate Summary</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="thinking">
        <span className="spinner" />
        Thinking…
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="summary-tab">
      <p className="summary-headline">{result.headline}</p>
      {result.bullets.length > 0 && (
        <ul className="summary-bullets">
          {result.bullets.map((b, i) => (
            <li key={i} className="summary-bullet">
              <span className="summary-bullet-label">{b.label}</span>
              <span className="summary-bullet-text">{b.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
