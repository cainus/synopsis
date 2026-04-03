import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { XIcon, ArrowLeftIcon } from "lucide-react";
import { useHighlighter } from "@/hooks/useHighlighter";
import { HighlightedLine } from "./HighlightedLine";
import type { DefinitionResult } from "../types";

interface Props {
  result: DefinitionResult;
  repoPath: string;
  onClose: () => void;
  onBack?: () => void;
}

export function DefinitionView({ result, onClose, onBack }: Props) {
  // Combine context_before + definition line + context_after
  const allLines = [
    ...result.context_before,
    result.line_content,
    ...result.context_after,
  ];

  const tokens = useHighlighter(allLines, result.file);
  const defLineIndex = result.context_before.length;
  const startLineNum = result.line_number - result.context_before.length;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent showCloseButton={false} className="max-w-[80vw] w-[80vw] max-h-[70vh] flex flex-col p-0 gap-0">
        <DialogHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-border shrink-0 space-y-0">
          <div className="flex items-center gap-2 min-w-0">
            {onBack && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground shrink-0" onClick={onBack}>
                <ArrowLeftIcon className="w-3.5 h-3.5" />
              </Button>
            )}
            <DialogTitle className="font-mono text-xs text-muted-foreground truncate">
              {result.file}:{result.line_number}
            </DialogTitle>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onClose}>
            <XIcon className="w-4 h-4" />
          </Button>
        </DialogHeader>
        <div className="overflow-auto flex-1">
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
                      <HighlightedLine tokens={tokens[i] ?? null} plainText={line || "\n"} />
                    ) : (
                      line || "\n"
                    )}
                  </span>
                </div>
              );
            })}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}
