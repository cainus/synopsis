import { useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

interface Props {
  lines: string[];
  loading: boolean;
  done: boolean;
  hasRepo: boolean;
  onGenerate: () => void;
}

export function SummaryTab({ lines, loading, done, hasRepo, onGenerate }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  if (!hasRepo) return <div className="status empty">Pick a repo folder to generate a summary.</div>;

  if (!loading && !done && lines.length === 0) {
    return (
      <div className="generate-prompt">
        <button onClick={onGenerate}>Generate Summary</button>
      </div>
    );
  }

  if (loading && lines.length === 0) {
    return (
      <div className="thinking">
        <span className="spinner" />
        Claude is thinking…
      </div>
    );
  }

  const text = lines.join("\n");

  return (
    <div className="summary-tab">
      <div className="summary-content">
        <ReactMarkdown>{text}</ReactMarkdown>
        {loading && <span className="cursor">▌</span>}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
