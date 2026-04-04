import { useMemo } from "react";
import { useHighlighter } from "@/hooks/useHighlighter";
import { HighlightedLine } from "./HighlightedLine";
import { diffBg, diffClass } from "@/lib/diffStyles";
import { isProseFile } from "@/lib/highlight";

/** Inline snippet renderer -- just the diff lines, no modal chrome */
export function SnippetBlock({ snippet, filePath, onTokenClick }: { snippet: string; filePath: string; onTokenClick?: (symbol: string, position: { x: number; y: number }) => void }) {
  const lines = useMemo(() => snippet.split("\n").filter((line) =>
    !line.startsWith("diff --git ") &&
    !line.startsWith("index ") &&
    !line.startsWith("new file ") &&
    !line.startsWith("deleted file ") &&
    !line.startsWith("--- ") &&
    !line.startsWith("+++ ") &&
    !line.startsWith("@@ ")
  ), [snippet]);

  const codeLines = useMemo(() => lines.map((l) =>
    l.startsWith("+") || l.startsWith("-") || l.startsWith(" ") ? l.slice(1) : l
  ), [lines]);

  const tokens = useHighlighter(codeLines, filePath);
  const prose = isProseFile(filePath);

  const bgFor = diffBg;
  const classFor = diffClass;

  return (
    <pre className={`m-0 font-mono text-xs leading-relaxed text-muted-foreground tab-[4] ${prose ? "whitespace-pre-wrap break-words" : "whitespace-pre"}`}>
      {lines.map((line, i) => (
        <div key={i} className={`min-h-[1em] ${tokens ? bgFor(line) : classFor(line)}`}>
          {tokens ? (
            <HighlightedLine tokens={tokens[i] ?? null} plainText={codeLines[i] || "\n"} onTokenClick={onTokenClick} />
          ) : (
            line || "\n"
          )}
        </div>
      ))}
    </pre>
  );
}
