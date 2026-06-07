import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";
import { useHighlighter } from "@/hooks/useHighlighter";
import { HighlightedLine } from "./HighlightedLine";
import { DefinitionPeek } from "./DefinitionPeek";
import { SearchBar } from "./SearchBar";
import { diffBg, diffClass } from "@/lib/diffStyles";
import { isProseFile } from "@/lib/highlight";

import { CurrentFileView } from "./CurrentFileView";

type ViewMode = "inline" | "side-by-side" | "current";

interface Props {
  diff: string;
  title: string;
  onClose: () => void;
}

const bgFor = diffBg;
const classFor = diffClass;

/** Strip the +/- /space prefix from a diff line to get pure code */
function stripPrefix(line: string): string {
  if (line.startsWith("+") || line.startsWith("-") || line.startsWith(" ")) {
    return line.slice(1);
  }
  return line;
}

function parseHunk(line: string): [number, number] {
  const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
  if (!match) return [0, 0];
  return [parseInt(match[1], 10), parseInt(match[2], 10)];
}

interface NumberedLine {
  text: string;
  code: string;        // prefix-stripped code for highlighting
  cls: string;         // full fallback class (text + bg)
  bg: string;          // background-only class for highlighted mode
  oldNum: string;
  newNum: string;
  isHunk: boolean;
  codeIndex: number;   // index into the stripped code array for token lookup
}

function computeLineNumbers(lines: string[]): NumberedLine[] {
  const result: NumberedLine[] = [];
  let oldLine = 0;
  let newLine = 0;
  let hasHunk = false;
  let codeIdx = 0;

  for (const line of lines) {
    const isHunk = line.startsWith("@@");
    const code = isHunk ? line : stripPrefix(line);

    if (isHunk) {
      const [o, n] = parseHunk(line);
      oldLine = o;
      newLine = n;
      hasHunk = true;
      result.push({ text: line, code, cls: classFor(line), bg: "", oldNum: "", newNum: "", isHunk: true, codeIndex: -1 });
    } else if (!hasHunk) {
      result.push({ text: line, code, cls: classFor(line), bg: bgFor(line), oldNum: "", newNum: "", isHunk: false, codeIndex: codeIdx++ });
    } else if (line.startsWith("+")) {
      result.push({ text: line, code, cls: classFor(line), bg: bgFor(line), oldNum: "", newNum: String(newLine), isHunk: false, codeIndex: codeIdx++ });
      newLine++;
    } else if (line.startsWith("-")) {
      result.push({ text: line, code, cls: classFor(line), bg: bgFor(line), oldNum: String(oldLine), newNum: "", isHunk: false, codeIndex: codeIdx++ });
      oldLine++;
    } else {
      result.push({ text: line, code, cls: classFor(line), bg: bgFor(line), oldNum: String(oldLine), newNum: String(newLine), isHunk: false, codeIndex: codeIdx++ });
      oldLine++;
      newLine++;
    }
  }
  return result;
}

/** Compute search highlight class for a line */
function searchHighlightClass(lineIndex: number, highlightLines: Set<number>, currentHighlight: number | null): string {
  if (!highlightLines.has(lineIndex)) return "";
  if (lineIndex === currentHighlight) return "bg-yellow-500/40";
  return "bg-yellow-500/20";
}

function InlineView({ lines, filePath, onTokenClick, highlightLines, currentHighlight }: {
  lines: string[];
  filePath: string;
  onTokenClick?: (symbol: string, position: { x: number; y: number }) => void;
  highlightLines?: Set<number>;
  currentHighlight?: number | null;
}) {
  const numbered = useMemo(() => computeLineNumbers(lines), [lines]);
  const codeLines = useMemo(() => numbered.filter((l) => !l.isHunk).map((l) => l.code), [numbered]);
  const tokens = useHighlighter(codeLines, filePath);
  const prose = isProseFile(filePath);
  const hl = highlightLines ?? new Set<number>();
  const ch = currentHighlight ?? null;

  return (
    <pre className={`m-0 font-mono text-xs leading-relaxed text-muted-foreground tab-[4] ${prose ? "whitespace-pre-wrap break-words" : "whitespace-pre"}`}>
      {numbered.filter((entry) => !entry.isHunk).map((entry, i) => {
        const searchCls = searchHighlightClass(i, hl, ch);
        return (
          <div
            key={i}
            className={`flex min-h-[1em] ${tokens ? entry.bg : entry.cls} ${searchCls}`}
            data-line-index={i}
          >
            <span className="inline-block w-10 shrink-0 text-right pr-2 text-muted-foreground/30 select-none">{entry.oldNum}</span>
            <span className="inline-block w-10 shrink-0 text-right pr-3 text-muted-foreground/30 select-none border-r border-border mr-3">{entry.newNum}</span>
            <span className="flex-1">
              {tokens && entry.codeIndex >= 0 ? (
                <HighlightedLine tokens={tokens[entry.codeIndex] ?? null} plainText={entry.code || "\n"} onTokenClick={onTokenClick} />
              ) : (
                entry.text || "\n"
              )}
            </span>
          </div>
        );
      })}
    </pre>
  );
}

interface SideEntry {
  line: string;
  cls: string;
  bg: string;
  num: string;
  isHunk: boolean;
  codeIndex: number;
}

function SideBySideView({ lines, filePath, onTokenClick, highlightLines, currentHighlight }: {
  lines: string[];
  filePath: string;
  onTokenClick?: (symbol: string, position: { x: number; y: number }) => void;
  highlightLines?: Set<number>;
  currentHighlight?: number | null;
}) {
  const prose = isProseFile(filePath);
  const hl = highlightLines ?? new Set<number>();
  const ch = currentHighlight ?? null;
  const { left, right, leftCode, rightCode, rowContentIndices } = useMemo(() => {
    const left: SideEntry[] = [];
    const right: SideEntry[] = [];
    const leftCode: string[] = [];
    const rightCode: string[] = [];
    // For each non-hunk row, store the content line indices it covers (for search highlighting)
    const rowContentIndices: number[][] = [];
    let oldLine = 0;
    let newLine = 0;
    let hasHunk = false;
    let leftIdx = 0;
    let rightIdx = 0;
    // contentIdx tracks the 0-based index into the non-hunk content lines array
    // (matching the contentLines array computed in DiffModal for search)
    let contentIdx = 0;

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith("@@")) {
        const [o, n] = parseHunk(line);
        oldLine = o;
        newLine = n;
        hasHunk = true;
        left.push({ line, cls: classFor(line), bg: "", num: "", isHunk: true, codeIndex: -1 });
        right.push({ line, cls: classFor(line), bg: "", num: "", isHunk: true, codeIndex: -1 });
        // Hunk lines are NOT counted in contentIdx (they're filtered out in contentLines)
        i++;
      } else if (!hasHunk) {
        const text = stripPrefix(line);
        if (line.startsWith("-")) {
          leftCode.push(text);
          left.push({ line: text, cls: classFor(line), bg: bgFor(line), num: "", isHunk: false, codeIndex: leftIdx++ });
          right.push({ line: "", cls: "bg-background", bg: "bg-background", num: "", isHunk: false, codeIndex: -1 });
        } else if (line.startsWith("+")) {
          rightCode.push(text);
          left.push({ line: "", cls: "bg-background", bg: "bg-background", num: "", isHunk: false, codeIndex: -1 });
          right.push({ line: text, cls: classFor(line), bg: bgFor(line), num: "", isHunk: false, codeIndex: rightIdx++ });
        } else {
          leftCode.push(text);
          rightCode.push(text);
          left.push({ line: text, cls: "", bg: "", num: "", isHunk: false, codeIndex: leftIdx++ });
          right.push({ line: text, cls: "", bg: "", num: "", isHunk: false, codeIndex: rightIdx++ });
        }
        rowContentIndices.push([contentIdx++]);
        i++;
      } else if (line.startsWith("-")) {
        const removes: { text: string; num: string; ci: number }[] = [];
        while (i < lines.length && lines[i].startsWith("-")) {
          const t = lines[i].slice(1);
          removes.push({ text: t, num: String(oldLine), ci: contentIdx++ });
          leftCode.push(t);
          oldLine++;
          i++;
        }
        const adds: { text: string; num: string; ci: number }[] = [];
        while (i < lines.length && lines[i].startsWith("+")) {
          const t = lines[i].slice(1);
          adds.push({ text: t, num: String(newLine), ci: contentIdx++ });
          rightCode.push(t);
          newLine++;
          i++;
        }
        const max = Math.max(removes.length, adds.length);
        for (let j = 0; j < max; j++) {
          left.push(j < removes.length
            ? { line: removes[j].text, cls: "text-red-400 bg-red-400/8", bg: "bg-red-400/8", num: removes[j].num, isHunk: false, codeIndex: leftIdx++ }
            : { line: "", cls: "bg-background", bg: "bg-background", num: "", isHunk: false, codeIndex: -1 });
          right.push(j < adds.length
            ? { line: adds[j].text, cls: "text-green-500 bg-green-500/8", bg: "bg-green-500/8", num: adds[j].num, isHunk: false, codeIndex: rightIdx++ }
            : { line: "", cls: "bg-background", bg: "bg-background", num: "", isHunk: false, codeIndex: -1 });
          // Map this row to all content indices it covers
          const indices: number[] = [];
          if (j < removes.length) indices.push(removes[j].ci);
          if (j < adds.length) indices.push(adds[j].ci);
          rowContentIndices.push(indices);
        }
      } else if (line.startsWith("+")) {
        const t = line.slice(1);
        rightCode.push(t);
        left.push({ line: "", cls: "bg-background", bg: "bg-background", num: "", isHunk: false, codeIndex: -1 });
        right.push({ line: t, cls: "text-green-500 bg-green-500/8", bg: "bg-green-500/8", num: String(newLine), isHunk: false, codeIndex: rightIdx++ });
        rowContentIndices.push([contentIdx++]);
        newLine++;
        i++;
      } else {
        const text = line.startsWith(" ") ? line.slice(1) : line;
        leftCode.push(text);
        rightCode.push(text);
        left.push({ line: text, cls: "", bg: "", num: String(oldLine), isHunk: false, codeIndex: leftIdx++ });
        right.push({ line: text, cls: "", bg: "", num: String(newLine), isHunk: false, codeIndex: rightIdx++ });
        rowContentIndices.push([contentIdx++]);
        oldLine++;
        newLine++;
        i++;
      }
    }

    return { left, right, leftCode, rightCode, rowContentIndices };
  }, [lines]);

  const leftTokens = useHighlighter(leftCode, filePath);
  const rightTokens = useHighlighter(rightCode, filePath);

  function renderContent(entry: SideEntry, allTokens: ReturnType<typeof useHighlighter>) {
    if (allTokens && entry.codeIndex >= 0) {
      return <HighlightedLine tokens={allTokens[entry.codeIndex] ?? null} plainText={entry.line || "\n"} onTokenClick={onTokenClick} />;
    }
    return entry.line || "\n";
  }

  // Build a set that maps row indices (non-hunk) to whether they should be highlighted
  let nonHunkIdx = 0;

  return (
    <pre className={`m-0 font-mono text-xs leading-relaxed text-muted-foreground tab-[4] ${prose ? "whitespace-pre-wrap break-words" : "whitespace-pre"}`}>
      {left.map((leftEntry, j) => {
        const rightEntry = right[j];
        if (leftEntry.isHunk) return null;
        const rowIdx = nonHunkIdx++;
        // For side-by-side, check if any content index in this row is highlighted
        const indices = rowContentIndices[rowIdx] ?? [];
        const hasHighlight = indices.some((ci) => hl.has(ci));
        const hasCurrent = indices.some((ci) => ci === ch);
        const searchCls = hasCurrent ? "bg-yellow-500/40" : hasHighlight ? "bg-yellow-500/20" : "";
        // Use the first content index for scrollIntoView targeting
        const dataIdx = indices[0] ?? -1;
        return (
          <div key={j} className={`flex min-h-[1em] ${searchCls}`} data-line-index={dataIdx}>
            <div className={`flex-1 flex min-w-0 ${leftTokens && leftEntry.codeIndex >= 0 ? leftEntry.bg : leftEntry.cls}`}>
              <span className="inline-block w-10 shrink-0 text-right pr-3 text-muted-foreground/30 select-none border-r border-border mr-3">{leftEntry.num}</span>
              <span className={`flex-1 ${prose ? "" : "overflow-x-auto"}`}>
                {renderContent(leftEntry, leftTokens)}
              </span>
            </div>
            <div className={`flex-1 flex min-w-0 border-l border-border ${rightTokens && rightEntry.codeIndex >= 0 ? rightEntry.bg : rightEntry.cls}`}>
              <span className="inline-block w-10 shrink-0 text-right pr-3 text-muted-foreground/30 select-none border-r border-border mr-3">{rightEntry.num}</span>
              <span className={`flex-1 ${prose ? "" : "overflow-x-auto"}`}>
                {renderContent(rightEntry, rightTokens)}
              </span>
            </div>
          </div>
        );
      })}
    </pre>
  );
}

export function DiffModal({ diff, title, onClose }: Props) {
  const [mode, setMode] = useState<ViewMode>("inline");
  const [peekSymbol, setPeekSymbol] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => diff.split("\n").filter((line) =>
    !line.startsWith("diff --git ") &&
    !line.startsWith("index ") &&
    !line.startsWith("new file ") &&
    !line.startsWith("deleted file ") &&
    !line.startsWith("--- ") &&
    !line.startsWith("+++ ")
  ), [diff]);

  // Compute content lines (non-hunk lines with stripped code for search)
  const contentLines = useMemo(() => {
    const result: string[] = [];
    for (const line of lines) {
      if (line.startsWith("@@")) continue;
      result.push(stripPrefix(line));
    }
    return result;
  }, [lines]);

  // Compute matching line indices (indices into contentLines array)
  const matchIndices = useMemo(() => {
    if (!searchQuery) return [];
    const query = searchQuery.toLowerCase();
    const matches: number[] = [];
    for (let i = 0; i < contentLines.length; i++) {
      if (contentLines[i].toLowerCase().includes(query)) {
        matches.push(i);
      }
    }
    return matches;
  }, [contentLines, searchQuery]);

  // Clamp currentMatchIndex to valid range
  const clampedMatchIndex = matchIndices.length > 0
    ? Math.min(currentMatchIndex, matchIndices.length - 1)
    : 0;

  // Build highlight set and current highlight line index
  const highlightLines = useMemo(() => new Set(matchIndices), [matchIndices]);
  const currentHighlight = matchIndices.length > 0 ? matchIndices[clampedMatchIndex] : null;

  // Reset match index when query changes
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchQuery]);

  // Scroll current match into view
  useEffect(() => {
    if (currentHighlight === null || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const el = container.querySelector(`[data-line-index="${currentHighlight}"]`);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [currentHighlight]);

  // Listen for Cmd+F / Ctrl+F
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        if (searchOpen) {
          // Focus the input if search is already open
          searchInputRef.current?.focus();
        } else {
          setSearchOpen(true);
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen]);

  // Focus input when search opens
  useEffect(() => {
    if (searchOpen) {
      // Use setTimeout to ensure the input is rendered
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [searchOpen]);

  const handleSearchClose = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setCurrentMatchIndex(0);
  }, []);

  // For "current" mode, CurrentFileView reports its own match count
  const [currentViewMatchCount, setCurrentViewMatchCount] = useState(0);

  // Effective match count depends on mode
  const effectiveMatchCount = mode === "current" ? currentViewMatchCount : matchIndices.length;
  const effectiveClampedIndex = effectiveMatchCount > 0
    ? Math.min(currentMatchIndex, effectiveMatchCount - 1)
    : 0;

  const handleNext = useCallback(() => {
    if (effectiveMatchCount === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % effectiveMatchCount);
  }, [effectiveMatchCount]);

  const handlePrev = useCallback(() => {
    if (effectiveMatchCount === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + effectiveMatchCount) % effectiveMatchCount);
  }, [effectiveMatchCount]);

  const handleTokenClick = useCallback((symbol: string, _position: { x: number; y: number }) => {
    setPeekSymbol(symbol);
  }, []);

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent showCloseButton={false} className="max-w-[95vw] w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-border shrink-0 space-y-0">
            <DialogTitle className="font-mono text-xs text-muted-foreground truncate">
              {title}
            </DialogTitle>
            <div className="flex items-center gap-3">
              <div className="flex border border-border rounded overflow-hidden">
                <Button
                  variant={mode === "inline" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-none text-[11px] h-7 px-2.5"
                  onClick={() => setMode("inline")}
                >
                  Inline
                </Button>
                <Button
                  variant={mode === "side-by-side" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-none text-[11px] h-7 px-2.5 border-l border-border"
                  onClick={() => setMode("side-by-side")}
                >
                  Side by side
                </Button>
                <Button
                  variant={mode === "current" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-none text-[11px] h-7 px-2.5 border-l border-border"
                  onClick={() => setMode("current")}
                >
                  Current
                </Button>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onClose}>
                <XIcon className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>
          {searchOpen && (
            <SearchBar
              ref={searchInputRef}
              query={searchQuery}
              onQueryChange={setSearchQuery}
              matchCount={effectiveMatchCount}
              currentMatch={effectiveMatchCount > 0 ? effectiveClampedIndex + 1 : 0}
              onNext={handleNext}
              onPrev={handlePrev}
              onClose={handleSearchClose}
            />
          )}
          <div className="overflow-auto flex-1" ref={scrollContainerRef}>
            {mode === "current"
              ? <CurrentFileView
                  filePath={title}
                  onTokenClick={handleTokenClick}
                  searchQuery={searchQuery}
                  currentMatchIndex={effectiveClampedIndex}
                  onMatchCount={setCurrentViewMatchCount}
                />
              : mode === "inline"
                ? <InlineView lines={lines} filePath={title} onTokenClick={handleTokenClick} highlightLines={highlightLines} currentHighlight={currentHighlight} />
                : <SideBySideView lines={lines} filePath={title} onTokenClick={handleTokenClick} highlightLines={highlightLines} currentHighlight={currentHighlight} />}
          </div>
          {peekSymbol && (
            <DefinitionPeek
              symbol={peekSymbol}
              filePath={title}
              onClose={() => setPeekSymbol(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
