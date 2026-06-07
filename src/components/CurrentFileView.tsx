import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRepoPath } from "@/contexts/RepoContext";
import { useHighlighter } from "@/hooks/useHighlighter";
import { HighlightedLine } from "./HighlightedLine";
import { isProseFile } from "@/lib/highlight";

interface Props {
  filePath: string;
  onTokenClick?: (symbol: string, position: { x: number; y: number }) => void;
  searchQuery?: string;
  currentMatchIndex?: number;
  onMatchCount?: (count: number) => void;
}

export function CurrentFileView({
  filePath,
  onTokenClick,
  searchQuery,
  currentMatchIndex = 0,
  onMatchCount,
}: Props) {
  const repoPath = useRepoPath();
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setContent(null);
    setError(null);

    invoke<string>("get_file_content", { repoPath, file: filePath })
      .then((result) => setContent(result))
      .catch(() => setError("File not found"));
  }, [repoPath, filePath]);

  const lines = useMemo(() => {
    if (!content) return [];
    // Split content into lines, removing trailing empty line from trailing newline
    const raw = content.split("\n");
    if (raw.length > 0 && raw[raw.length - 1] === "") {
      raw.pop();
    }
    return raw;
  }, [content]);

  const tokens = useHighlighter(lines, filePath);
  const prose = isProseFile(filePath);

  // Search matching
  const matchIndices = useMemo(() => {
    if (!searchQuery) return [];
    const query = searchQuery.toLowerCase();
    const matches: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(query)) {
        matches.push(i);
      }
    }
    return matches;
  }, [lines, searchQuery]);

  // Report match count
  useEffect(() => {
    onMatchCount?.(matchIndices.length);
  }, [matchIndices.length, onMatchCount]);

  const highlightSet = useMemo(() => new Set(matchIndices), [matchIndices]);
  const currentHighlight = matchIndices.length > 0
    ? matchIndices[Math.min(currentMatchIndex, matchIndices.length - 1)]
    : null;

  // Scroll current match into view
  useEffect(() => {
    if (currentHighlight === null) return;
    const el = document.querySelector(`[data-line-index="${currentHighlight}"]`);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [currentHighlight]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-12">
        {error}
      </div>
    );
  }

  if (content === null) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-12">
        Loading file...
      </div>
    );
  }

  return (
    <pre className={`m-0 font-mono text-xs leading-relaxed text-muted-foreground tab-[4] ${prose ? "whitespace-pre-wrap break-words" : "whitespace-pre"}`}>
      {lines.map((line, i) => {
        const isMatch = highlightSet.has(i);
        const isCurrent = i === currentHighlight;
        const searchCls = isCurrent
          ? "bg-yellow-500/40"
          : isMatch
            ? "bg-yellow-500/20"
            : "";

        return (
          <div
            key={i}
            className={`flex min-h-[1em] ${searchCls}`}
            data-line-index={i}
          >
            <span className="inline-block w-10 shrink-0 text-right pr-3 text-muted-foreground/30 select-none border-r border-border mr-3">
              {i + 1}
            </span>
            <span className="flex-1">
              {tokens ? (
                <HighlightedLine
                  tokens={tokens[i] ?? null}
                  plainText={line || "\n"}
                  onTokenClick={onTokenClick}
                />
              ) : (
                line || "\n"
              )}
            </span>
          </div>
        );
      })}
    </pre>
  );
}
