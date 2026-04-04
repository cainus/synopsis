import { useState, useMemo, useCallback } from "react";
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
import { DefinitionPopover } from "./DefinitionPopover";
import { diffBg, diffClass } from "@/lib/diffStyles";

type ViewMode = "inline" | "side-by-side";

interface Props {
  diff: string;
  title: string;
  onClose: () => void;
  repoPath?: string | null;
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

function InlineView({ lines, filePath, onTokenClick }: { lines: string[]; filePath: string; onTokenClick?: (symbol: string, position: { x: number; y: number }) => void }) {
  const numbered = useMemo(() => computeLineNumbers(lines), [lines]);
  const codeLines = useMemo(() => numbered.filter((l) => !l.isHunk).map((l) => l.code), [numbered]);
  const tokens = useHighlighter(codeLines, filePath);

  return (
    <pre className="m-0 font-mono text-xs leading-relaxed text-muted-foreground whitespace-pre tab-[4]">
      {numbered.map((entry, i) => (
        <div key={i} className={`flex min-h-[1em] ${tokens && !entry.isHunk ? entry.bg : entry.cls}`}>
          <span className="inline-block w-10 shrink-0 text-right pr-2 text-muted-foreground/30 select-none">{entry.oldNum}</span>
          <span className="inline-block w-10 shrink-0 text-right pr-3 text-muted-foreground/30 select-none border-r border-border mr-3">{entry.newNum}</span>
          <span className="flex-1">
            {entry.isHunk ? (
              entry.text || "\n"
            ) : tokens && entry.codeIndex >= 0 ? (
              <HighlightedLine tokens={tokens[entry.codeIndex] ?? null} plainText={entry.code || "\n"} onTokenClick={onTokenClick} />
            ) : (
              entry.text || "\n"
            )}
          </span>
        </div>
      ))}
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

function SideBySideView({ lines, filePath, onTokenClick }: { lines: string[]; filePath: string; onTokenClick?: (symbol: string, position: { x: number; y: number }) => void }) {
  const { left, right, leftCode, rightCode } = useMemo(() => {
    const left: SideEntry[] = [];
    const right: SideEntry[] = [];
    const leftCode: string[] = [];
    const rightCode: string[] = [];
    let oldLine = 0;
    let newLine = 0;
    let hasHunk = false;
    let leftIdx = 0;
    let rightIdx = 0;

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
        i++;
      } else if (line.startsWith("-")) {
        const removes: { text: string; num: string }[] = [];
        while (i < lines.length && lines[i].startsWith("-")) {
          const t = lines[i].slice(1);
          removes.push({ text: t, num: String(oldLine) });
          leftCode.push(t);
          oldLine++;
          i++;
        }
        const adds: { text: string; num: string }[] = [];
        while (i < lines.length && lines[i].startsWith("+")) {
          const t = lines[i].slice(1);
          adds.push({ text: t, num: String(newLine) });
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
        }
      } else if (line.startsWith("+")) {
        const t = line.slice(1);
        rightCode.push(t);
        left.push({ line: "", cls: "bg-background", bg: "bg-background", num: "", isHunk: false, codeIndex: -1 });
        right.push({ line: t, cls: "text-green-500 bg-green-500/8", bg: "bg-green-500/8", num: String(newLine), isHunk: false, codeIndex: rightIdx++ });
        newLine++;
        i++;
      } else {
        const text = line.startsWith(" ") ? line.slice(1) : line;
        leftCode.push(text);
        rightCode.push(text);
        left.push({ line: text, cls: "", bg: "", num: String(oldLine), isHunk: false, codeIndex: leftIdx++ });
        right.push({ line: text, cls: "", bg: "", num: String(newLine), isHunk: false, codeIndex: rightIdx++ });
        oldLine++;
        newLine++;
        i++;
      }
    }

    return { left, right, leftCode, rightCode };
  }, [lines]);

  const leftTokens = useHighlighter(leftCode, filePath);
  const rightTokens = useHighlighter(rightCode, filePath);

  function renderPane(entries: SideEntry[], allTokens: ReturnType<typeof useHighlighter>) {
    return entries.map((entry, j) => (
      <div key={j} className={`flex min-h-[1em] ${allTokens && !entry.isHunk && entry.codeIndex >= 0 ? entry.bg : entry.cls}`}>
        <span className="inline-block w-10 shrink-0 text-right pr-3 text-muted-foreground/30 select-none border-r border-border mr-3">{entry.num}</span>
        <span className="flex-1">
          {entry.isHunk ? (
            entry.line || "\n"
          ) : allTokens && entry.codeIndex >= 0 ? (
            <HighlightedLine tokens={allTokens[entry.codeIndex] ?? null} plainText={entry.line || "\n"} onTokenClick={onTokenClick} />
          ) : (
            entry.line || "\n"
          )}
        </span>
      </div>
    ));
  }

  return (
    <div className="flex min-h-0">
      <pre className="flex-1 m-0 font-mono text-xs leading-relaxed text-muted-foreground whitespace-pre tab-[4] overflow-x-auto min-w-0">
        {renderPane(left, leftTokens)}
      </pre>
      <pre className="flex-1 m-0 font-mono text-xs leading-relaxed text-muted-foreground whitespace-pre tab-[4] overflow-x-auto min-w-0 border-l border-border">
        {renderPane(right, rightTokens)}
      </pre>
    </div>
  );
}

export function DiffModal({ diff, title, onClose, repoPath }: Props) {
  const [mode, setMode] = useState<ViewMode>("inline");
  const [popover, setPopover] = useState<{ symbol: string; position: { x: number; y: number } } | null>(null);

  const lines = useMemo(() => diff.split("\n").filter((line) =>
    !line.startsWith("diff --git ") &&
    !line.startsWith("index ") &&
    !line.startsWith("new file ") &&
    !line.startsWith("deleted file ") &&
    !line.startsWith("--- ") &&
    !line.startsWith("+++ ")
  ), [diff]);

  const handleTokenClick = useCallback((symbol: string, position: { x: number; y: number }) => {
    console.log("[DiffModal] Token clicked:", symbol, "repoPath:", repoPath);
    if (repoPath) {
      setPopover({ symbol, position });
    }
  }, [repoPath]);

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
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onClose}>
                <XIcon className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="overflow-auto flex-1">
            {mode === "inline"
              ? <InlineView lines={lines} filePath={title} onTokenClick={repoPath ? handleTokenClick : undefined} />
              : <SideBySideView lines={lines} filePath={title} onTokenClick={repoPath ? handleTokenClick : undefined} />}
          </div>
        </DialogContent>
      </Dialog>
      {popover && repoPath && (
        <DefinitionPopover
          symbol={popover.symbol}
          filePath={title}
          repoPath={repoPath}
          position={popover.position}
          onClose={() => setPopover(null)}
        />
      )}
    </>
  );
}
