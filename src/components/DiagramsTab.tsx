import { useEffect, useRef } from "react";
import mermaid from "mermaid";
import { Button } from "@/components/ui/button";
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

  return <div ref={ref} className="flex-1 bg-background border border-border rounded-lg p-4 overflow-auto flex items-center justify-center min-h-[180px] [&_svg]:max-w-full [&_svg]:h-auto" />;
}

const legendDotColors = {
  removed: "bg-red-500",
  modified: "bg-amber-500",
  added: "bg-green-500",
} as const;

function LegendDot({ color, label }: { color: keyof typeof legendDotColors; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block w-2 h-2 rounded-full ${legendDotColors[color]}`} />
      <span>{label}</span>
    </span>
  );
}

export function DiagramsTab({ result, loading, hasRepo, onGenerate }: Props) {
  if (!hasRepo) return <div className="text-muted-foreground/60 py-8 text-center">Pick a repo folder to generate diagrams.</div>;

  if (!loading && !result) {
    return (
      <div className="flex justify-center py-12">
        <Button onClick={onGenerate}>Generate Diagrams</Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2.5 text-muted-foreground py-12 text-sm">
        <span className="inline-block w-3.5 h-3.5 border-2 border-muted border-t-primary rounded-full animate-spin shrink-0" />
        Thinking…
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2.5">
          Before
          <span className="flex items-center gap-2.5 text-[10px] tracking-wide text-muted-foreground/40">
            <LegendDot color="removed" label="removed" />
            <LegendDot color="modified" label="modified" />
          </span>
        </div>
        {result!.before_caption && <p className="text-xs text-muted-foreground mb-2.5 leading-relaxed">{result!.before_caption}</p>}
        <Diagram id="diagram-before" chart={result!.before} />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2.5">
          After
          <span className="flex items-center gap-2.5 text-[10px] tracking-wide text-muted-foreground/40">
            <LegendDot color="added" label="added" />
            <LegendDot color="modified" label="modified" />
          </span>
        </div>
        {result!.after_caption && <p className="text-xs text-muted-foreground mb-2.5 leading-relaxed">{result!.after_caption}</p>}
        <Diagram id="diagram-after" chart={result!.after} />
      </div>
    </div>
  );
}
