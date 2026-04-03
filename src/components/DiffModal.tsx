import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

type ViewMode = "inline" | "side-by-side";

interface Props {
  diff: string;
  title: string;
  onClose: () => void;
}

function classFor(line: string): string {
  if (line.startsWith("+")) return "text-green-500 bg-green-500/8";
  if (line.startsWith("-")) return "text-red-400 bg-red-400/8";
  if (line.startsWith("@@")) return "text-primary";
  return "";
}

/** Parse @@ -oldStart,oldCount +newStart,newCount @@ into [oldStart, newStart] */
function parseHunk(line: string): [number, number] {
  const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
  if (!match) return [0, 0];
  return [parseInt(match[1], 10), parseInt(match[2], 10)];
}

interface NumberedLine {
  text: string;
  cls: string;
  oldNum: string;
  newNum: string;
}

function computeLineNumbers(lines: string[]): NumberedLine[] {
  const result: NumberedLine[] = [];
  let oldLine = 0;
  let newLine = 0;
  let hasHunk = false;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      const [o, n] = parseHunk(line);
      oldLine = o;
      newLine = n;
      hasHunk = true;
      result.push({ text: line, cls: classFor(line), oldNum: "", newNum: "" });
    } else if (!hasHunk) {
      result.push({ text: line, cls: classFor(line), oldNum: "", newNum: "" });
    } else if (line.startsWith("+")) {
      result.push({ text: line, cls: classFor(line), oldNum: "", newNum: String(newLine) });
      newLine++;
    } else if (line.startsWith("-")) {
      result.push({ text: line, cls: classFor(line), oldNum: String(oldLine), newNum: "" });
      oldLine++;
    } else {
      result.push({ text: line, cls: classFor(line), oldNum: String(oldLine), newNum: String(newLine) });
      oldLine++;
      newLine++;
    }
  }
  return result;
}

function InlineView({ lines }: { lines: string[] }) {
  const numbered = computeLineNumbers(lines);
  return (
    <pre className="m-0 font-mono text-xs leading-relaxed text-muted-foreground whitespace-pre tab-[4]">
      {numbered.map((entry, i) => (
        <div key={i} className={`flex min-h-[1em] ${entry.cls}`}>
          <span className="inline-block w-10 shrink-0 text-right pr-2 text-muted-foreground/30 select-none">{entry.oldNum}</span>
          <span className="inline-block w-10 shrink-0 text-right pr-3 text-muted-foreground/30 select-none border-r border-border mr-3">{entry.newNum}</span>
          <span className="flex-1">{entry.text || "\n"}</span>
        </div>
      ))}
    </pre>
  );
}

interface SideEntry {
  line: string;
  cls: string;
  num: string;
}

function SideBySideView({ lines }: { lines: string[] }) {
  const left: SideEntry[] = [];
  const right: SideEntry[] = [];
  let oldLine = 0;
  let newLine = 0;
  let hasHunk = false;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("@@")) {
      const [o, n] = parseHunk(line);
      oldLine = o;
      newLine = n;
      hasHunk = true;
      left.push({ line, cls: classFor(line), num: "" });
      right.push({ line, cls: classFor(line), num: "" });
      i++;
    } else if (!hasHunk) {
      const text = line.startsWith("+") ? line.slice(1) : line.startsWith("-") ? line.slice(1) : line.startsWith(" ") ? line.slice(1) : line;
      const cls = classFor(line);
      left.push({ line: line.startsWith("-") ? text : line.startsWith("+") ? "" : text, cls: line.startsWith("-") ? cls : line.startsWith("+") ? "bg-background" : cls, num: "" });
      right.push({ line: line.startsWith("+") ? text : line.startsWith("-") ? "" : text, cls: line.startsWith("+") ? cls : line.startsWith("-") ? "bg-background" : cls, num: "" });
      i++;
    } else if (line.startsWith("-")) {
      const removes: { text: string; num: string }[] = [];
      while (i < lines.length && lines[i].startsWith("-")) {
        removes.push({ text: lines[i].slice(1), num: String(oldLine) });
        oldLine++;
        i++;
      }
      const adds: { text: string; num: string }[] = [];
      while (i < lines.length && lines[i].startsWith("+")) {
        adds.push({ text: lines[i].slice(1), num: String(newLine) });
        newLine++;
        i++;
      }
      const max = Math.max(removes.length, adds.length);
      for (let j = 0; j < max; j++) {
        left.push(j < removes.length
          ? { line: removes[j].text, cls: "text-red-400 bg-red-400/8", num: removes[j].num }
          : { line: "", cls: "bg-background", num: "" });
        right.push(j < adds.length
          ? { line: adds[j].text, cls: "text-green-500 bg-green-500/8", num: adds[j].num }
          : { line: "", cls: "bg-background", num: "" });
      }
    } else if (line.startsWith("+")) {
      left.push({ line: "", cls: "bg-background", num: "" });
      right.push({ line: line.slice(1), cls: "text-green-500 bg-green-500/8", num: String(newLine) });
      newLine++;
      i++;
    } else {
      const text = line.startsWith(" ") ? line.slice(1) : line;
      left.push({ line: text, cls: "", num: String(oldLine) });
      right.push({ line: text, cls: "", num: String(newLine) });
      oldLine++;
      newLine++;
      i++;
    }
  }

  return (
    <div className="flex min-h-0">
      <pre className="flex-1 m-0 font-mono text-xs leading-relaxed text-muted-foreground whitespace-pre tab-[4] overflow-x-auto min-w-0">
        {left.map((entry, j) => (
          <div key={j} className={`flex min-h-[1em] ${entry.cls}`}>
            <span className="inline-block w-10 shrink-0 text-right pr-3 text-muted-foreground/30 select-none border-r border-border mr-3">{entry.num}</span>
            <span className="flex-1">{entry.line || "\n"}</span>
          </div>
        ))}
      </pre>
      <pre className="flex-1 m-0 font-mono text-xs leading-relaxed text-muted-foreground whitespace-pre tab-[4] overflow-x-auto min-w-0 border-l border-border">
        {right.map((entry, j) => (
          <div key={j} className={`flex min-h-[1em] ${entry.cls}`}>
            <span className="inline-block w-10 shrink-0 text-right pr-3 text-muted-foreground/30 select-none border-r border-border mr-3">{entry.num}</span>
            <span className="flex-1">{entry.line || "\n"}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}

export function DiffModal({ diff, title, onClose }: Props) {
  const [mode, setMode] = useState<ViewMode>("inline");

  const lines = diff.split("\n").filter((line) =>
    !line.startsWith("diff --git ") &&
    !line.startsWith("index ") &&
    !line.startsWith("new file ") &&
    !line.startsWith("deleted file ") &&
    !line.startsWith("--- ") &&
    !line.startsWith("+++ ")
  );

  return (
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
            ? <InlineView lines={lines} />
            : <SideBySideView lines={lines} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
