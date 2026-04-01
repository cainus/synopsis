import { Button } from "@/components/ui/button";
import type { SummaryResult } from "../types";

interface Props {
  result: SummaryResult | null;
  loading: boolean;
  hasRepo: boolean;
  onGenerate: () => void;
}

export function SummaryTab({ result, loading, hasRepo, onGenerate }: Props) {
  if (!hasRepo) return <div className="text-muted-foreground/60 py-8 text-center">Pick a repo folder to generate a summary.</div>;

  if (!loading && !result) {
    return (
      <div className="flex justify-center py-12">
        <Button onClick={onGenerate}>Generate Summary</Button>
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

  if (!result) return null;

  return (
    <div className="max-w-[780px]">
      <p className="text-lg font-semibold text-foreground mb-3 leading-snug">{result.headline}</p>
      {result.bullets.length > 0 && (
        <ul className="space-y-0">
          {result.bullets.map((b, i) => (
            <li key={i} className="flex items-baseline gap-2 py-1.5 border-b border-border last:border-b-0">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-primary whitespace-nowrap min-w-[90px]">
                {b.label}
              </span>
              <span className="text-sm leading-relaxed text-muted-foreground">{b.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
