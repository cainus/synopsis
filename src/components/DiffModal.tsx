import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ViewMode = "inline" | "side-by-side";

interface Props {
  diff: string;
  title: string;
  onClose: () => void;
}

function classFor(line: string): string {
  if (line.startsWith("+") && !line.startsWith("+++")) return "text-green-500 bg-green-500/8";
  if (line.startsWith("-") && !line.startsWith("---")) return "text-red-400 bg-red-400/8";
  if (line.startsWith("@@")) return "text-primary";
  if (line.startsWith("diff ")) return "text-muted-foreground/60";
  return "";
}

function DiffLine({ line }: { line: string }) {
  return <div className={`min-h-[1em] ${classFor(line)}`}>{line || "\n"}</div>;
}

function InlineView({ lines }: { lines: string[] }) {
  return (
    <pre className="m-0 p-3 px-4 font-mono text-xs leading-relaxed text-muted-foreground whitespace-pre tab-[4]">
      {lines.map((line, i) => (
        <DiffLine key={i} line={line} />
      ))}
    </pre>
  );
}

function SideBySideView({ lines }: { lines: string[] }) {
  const left: { line: string; cls: string }[] = [];
  const right: { line: string; cls: string }[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("@@") || line.startsWith("diff ") || line.startsWith("---") || line.startsWith("+++") || line.startsWith("index ")) {
      const cls = classFor(line);
      left.push({ line, cls });
      right.push({ line, cls });
      i++;
    } else if (line.startsWith("-")) {
      const removes: string[] = [];
      while (i < lines.length && lines[i].startsWith("-") && !lines[i].startsWith("---")) {
        removes.push(lines[i].slice(1));
        i++;
      }
      const adds: string[] = [];
      while (i < lines.length && lines[i].startsWith("+") && !lines[i].startsWith("+++")) {
        adds.push(lines[i].slice(1));
        i++;
      }
      const max = Math.max(removes.length, adds.length);
      for (let j = 0; j < max; j++) {
        left.push(j < removes.length
          ? { line: removes[j], cls: "text-red-400 bg-red-400/8" }
          : { line: "", cls: "bg-background" });
        right.push(j < adds.length
          ? { line: adds[j], cls: "text-green-500 bg-green-500/8" }
          : { line: "", cls: "bg-background" });
      }
    } else if (line.startsWith("+")) {
      left.push({ line: "", cls: "bg-background" });
      right.push({ line: line.slice(1), cls: "text-green-500 bg-green-500/8" });
      i++;
    } else {
      const text = line.startsWith(" ") ? line.slice(1) : line;
      left.push({ line: text, cls: "" });
      right.push({ line: text, cls: "" });
      i++;
    }
  }

  return (
    <div className="flex min-h-0">
      <pre className="flex-1 m-0 p-3 px-4 font-mono text-xs leading-relaxed text-muted-foreground whitespace-pre tab-[4] overflow-x-auto min-w-0">
        {left.map((entry, j) => (
          <div key={j} className={`min-h-[1em] ${entry.cls}`}>{entry.line || "\n"}</div>
        ))}
      </pre>
      <pre className="flex-1 m-0 p-3 px-4 font-mono text-xs leading-relaxed text-muted-foreground whitespace-pre tab-[4] overflow-x-auto min-w-0 border-l border-border">
        {right.map((entry, j) => (
          <div key={j} className={`min-h-[1em] ${entry.cls}`}>{entry.line || "\n"}</div>
        ))}
      </pre>
    </div>
  );
}

export function DiffModal({ diff, title, onClose }: Props) {
  const [mode, setMode] = useState<ViewMode>("inline");

  const lines = diff.split("\n");

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className={`${mode === "side-by-side" ? "max-w-[1400px]" : "max-w-[900px]"} w-[90vw] max-h-[80vh] flex flex-col p-0 gap-0`}>
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
