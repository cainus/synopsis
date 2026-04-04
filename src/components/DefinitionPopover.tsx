import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileCodeIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { langFromPath } from "@/lib/highlight";
import type { DefinitionResult } from "../types";
import { DefinitionView } from "./DefinitionView";
import { useRepoPath } from "@/contexts/RepoContext";

interface Props {
  symbol: string;
  filePath: string;
  position: { x: number; y: number };
  onClose: () => void;
}

export function DefinitionPopover({ symbol, filePath, position, onClose }: Props) {
  const repoPath = useRepoPath();
  const [results, setResults] = useState<DefinitionResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<DefinitionResult | null>(null);

  useEffect(() => {
    const lang = langFromPath(filePath) ?? "";
    invoke<DefinitionResult[]>("find_symbol_definition", {
      repoPath,
      symbol,
      languageHint: lang,
    })
      .then((res) => {
        setResults(res);
        // Auto-open if exactly one result
        if (res.length === 1) {
          setSelectedResult(res[0]);
        }
      })
      .catch((e) => setError(String(e)));
  }, [symbol, filePath, repoPath]);

  // Position the popover near the click, clamped to viewport
  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.min(position.x, window.innerWidth - 420),
    top: Math.min(position.y + 10, window.innerHeight - 300),
    zIndex: 2000,
  };

  if (selectedResult) {
    return (
      <DefinitionView
        result={selectedResult}
        onClose={onClose}
        onBack={results && results.length > 1 ? () => setSelectedResult(null) : undefined}
      />
    );
  }

  return (
    <>
      {/* Backdrop to catch clicks outside */}
      <div className="fixed inset-0 z-[1999]" onClick={onClose} />
      <div style={style} className="w-[400px] max-h-[280px] bg-popover border border-border rounded-lg shadow-xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
          <span className="text-xs font-medium text-foreground truncate">
            {results === null ? "Searching…" : `Definitions of "${symbol}"`}
          </span>
          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground" onClick={onClose}>
            <XIcon className="w-3 h-3" />
          </Button>
        </div>
        <div className="overflow-auto flex-1">
          {error && (
            <div className="px-3 py-4 text-xs text-destructive">{error}</div>
          )}
          {results !== null && results.length === 0 && (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">No definitions found</div>
          )}
          {results && results.map((r, i) => (
            <button
              key={i}
              className="flex items-start gap-2 w-full px-3 py-2 text-left hover:bg-accent border-b border-border last:border-b-0 cursor-pointer bg-transparent border-x-0 border-t-0"
              onClick={() => setSelectedResult(r)}
            >
              <FileCodeIcon className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0 overflow-hidden">
                <div className="text-xs font-mono text-primary truncate">{r.file}:{r.line_number}</div>
                <div className="text-xs font-mono text-muted-foreground truncate">{r.line_content}</div>
              </div>
            </button>
          ))}
          {results === null && !error && (
            <div className="flex items-center justify-center gap-2 py-4">
              <span className="inline-block w-3 h-3 border-[1.5px] border-muted border-t-primary rounded-full animate-spin" />
              <span className="text-xs text-muted-foreground">Searching…</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
