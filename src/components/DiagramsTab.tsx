import { useEffect, useRef } from "react";
import mermaid from "mermaid";
import type { DiagramsResult } from "../types";

mermaid.initialize({ startOnLoad: false, theme: "dark" });

interface Props {
  result: DiagramsResult | null;
  loading: boolean;
  hasRepo: boolean;
  onGenerate: () => void;
}

interface DiagramProps {
  id: string;
  chart: string;
}

function Diagram({ id, chart }: DiagramProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    mermaid.render(id, chart).then(({ svg }) => {
      if (ref.current) ref.current.innerHTML = svg;
    }).catch(() => {
      if (ref.current) ref.current.textContent = chart;
    });
  }, [id, chart]);

  return <div ref={ref} className="diagram-render" />;
}

export function DiagramsTab({ result, loading, hasRepo, onGenerate }: Props) {
  if (!hasRepo) return <div className="status empty">Pick a repo folder to generate diagrams.</div>;

  if (!loading && !result) {
    return (
      <div className="generate-prompt">
        <button onClick={onGenerate}>Generate Diagrams</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="thinking">
        <span className="spinner" />
        Claude is thinking…
      </div>
    );
  }

  return (
    <div className="diagrams-tab">
      <div className="diagram-panel">
        <div className="diagram-label">Before</div>
        <Diagram id="diagram-before" chart={result!.before} />
      </div>
      <div className="diagram-panel">
        <div className="diagram-label">After</div>
        <Diagram id="diagram-after" chart={result!.after} />
      </div>
    </div>
  );
}
