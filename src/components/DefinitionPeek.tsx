import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { XIcon, ArrowLeftIcon, CopyIcon, CheckIcon, FileCodeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHighlighter } from "@/hooks/useHighlighter";
import { HighlightedLine } from "./HighlightedLine";
import { langFromPath } from "@/lib/highlight";
import { useRepoPath } from "@/contexts/RepoContext";
import type { DefinitionResult } from "../types";

interface Props {
  symbol: string;
  filePath: string;
  onClose: () => void;
}

export function DefinitionPeek({ symbol, filePath, onClose }: Props) {
  const repoPath = useRepoPath();
  const [history, setHistory] = useState<DefinitionResult[]>([]);
  const [current, setCurrent] = useState<DefinitionResult | null>(null);
  const [pendingResults, setPendingResults] = useState<DefinitionResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [noResults, setNoResults] = useState(false);
  const [copied, setCopied] = useState(false);

  // Initial lookup on mount
  useEffect(() => {
    const lang = langFromPath(filePath) ?? "";
    invoke<DefinitionResult[]>("find_symbol_definition", {
      repoPath,
      symbol,
      languageHint: lang,
    })
      .then((results) => {
        setLoading(false);
        if (results.length === 1) {
          setCurrent(results[0]);
        } else if (results.length > 1) {
          setPendingResults(results);
        } else {
          setNoResults(true);
        }
      })
      .catch(() => {
        setLoading(false);
        setNoResults(true);
      });
  }, [symbol, filePath, repoPath]);

  const navigateTo = useCallback((newSymbol: string) => {
    setLoading(true);
    setNoResults(false);
    const lang = langFromPath(current?.file ?? filePath) ?? "";
    invoke<DefinitionResult[]>("find_symbol_definition", {
      repoPath,
      symbol: newSymbol,
      languageHint: lang,
    })
      .then((results) => {
        setLoading(false);
        if (results.length === 1) {
          if (current) {
            setHistory((prev) => [...prev, current]);
          }
          setCurrent(results[0]);
          setPendingResults(null);
        } else if (results.length > 1) {
          setPendingResults(results);
        } else {
          setNoResults(true);
          setTimeout(() => setNoResults(false), 2000);
        }
      })
      .catch(() => {
        setLoading(false);
      });
  }, [current, filePath, repoPath]);

  const handleTokenClick = useCallback((newSymbol: string, _position: { x: number; y: number }) => {
    navigateTo(newSymbol);
  }, [navigateTo]);

  const handleBack = useCallback(() => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      setCurrent(prev);
      setPendingResults(null);
      setNoResults(false);
    }
  }, [history]);

  const handleSelectResult = useCallback((r: DefinitionResult) => {
    if (current) {
      setHistory((prev) => [...prev, current]);
    }
    setCurrent(r);
    setPendingResults(null);
  }, [current]);

  const handleCopy = useCallback(() => {
    if (!current) return;
    navigator.clipboard.writeText(`${current.file}:${current.line_number}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [current]);

  // Code view data
  const allLines = current
    ? [...current.context_before, current.line_content, ...current.context_after]
    : [];
  const tokens = useHighlighter(allLines, current?.file ?? "");
  const defLineIndex = current ? current.context_before.length : -1;
  const startLineNum = current ? current.line_number - current.context_before.length : 0;

  const showBackButton = history.length > 0;

  return (
    <div className="border-t border-border bg-muted/30 flex flex-col max-h-[40%] shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {showBackButton && (
            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground shrink-0" onClick={handleBack} aria-label="Back">
              <ArrowLeftIcon className="w-3 h-3" />
            </Button>
          )}
          <span className="font-mono text-xs text-muted-foreground truncate">
            {loading ? "Looking up definition..." :
             noResults ? "No definitions found" :
             current ? `${current.file}:${current.line_number}` :
             pendingResults ? `Definitions of "${symbol}"` :
             ""}
          </span>
          {current && !loading && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground shrink-0"
              onClick={handleCopy}
              aria-label={copied ? "Copied" : "Copy path"}
            >
              {copied ? <CheckIcon className="w-3 h-3" /> : <CopyIcon className="w-3 h-3" />}
            </Button>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground" onClick={onClose} aria-label="Close peek">
          <XIcon className="w-3 h-3" />
        </Button>
      </div>

      {/* Content */}
      <div className="overflow-auto flex-1">
        {loading && (
          <div className="flex items-center justify-center py-4">
            <span className="inline-block w-3 h-3 border-[1.5px] border-muted border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {noResults && !loading && (
          <div className="px-3 py-4 text-xs text-muted-foreground text-center">No matching definitions in the codebase</div>
        )}

        {pendingResults && !loading && (
          <div>
            {pendingResults.map((r, i) => (
              <button
                key={i}
                className="flex items-start gap-2 w-full px-3 py-2 text-left hover:bg-accent border-b border-border last:border-b-0 cursor-pointer bg-transparent border-x-0 border-t-0"
                onClick={() => handleSelectResult(r)}
              >
                <FileCodeIcon className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0 overflow-hidden">
                  <div className="text-xs font-mono text-primary truncate">{r.file}:{r.line_number}</div>
                  <div className="text-xs font-mono text-muted-foreground truncate">{r.line_content}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {current && !pendingResults && !loading && (
          <pre className="m-0 font-mono text-xs leading-relaxed text-muted-foreground whitespace-pre tab-[4]">
            {allLines.map((line, i) => {
              const lineNum = startLineNum + i;
              const isDef = i === defLineIndex;
              return (
                <div key={i} className={`flex min-h-[1em] ${isDef ? "bg-primary/10" : ""}`}>
                  <span className="inline-block w-12 shrink-0 text-right pr-3 text-muted-foreground/30 select-none border-r border-border mr-3">
                    {lineNum > 0 ? lineNum : ""}
                  </span>
                  <span className="flex-1">
                    {tokens ? (
                      <HighlightedLine tokens={tokens[i] ?? null} plainText={line || "\n"} onTokenClick={handleTokenClick} />
                    ) : (
                      line || "\n"
                    )}
                  </span>
                </div>
              );
            })}
          </pre>
        )}
      </div>
    </div>
  );
}
