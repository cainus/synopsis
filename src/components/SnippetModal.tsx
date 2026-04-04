import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileCodeIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FileSnippet } from "../types";
import { DiffModal } from "./DiffModal";
import { DefinitionPopover } from "./DefinitionPopover";
import { SnippetBlock } from "./SnippetBlock";
import { useRepoPath } from "@/contexts/RepoContext";

/** Group FileSnippet[] by file path */
export function groupSnippetsByFile(files: FileSnippet[]): { file: string; snippets: string[] }[] {
  const map = new Map<string, string[]>();
  for (const fs of files) {
    if (!map.has(fs.file)) map.set(fs.file, []);
    map.get(fs.file)!.push(fs.snippet);
  }
  return Array.from(map.entries()).map(([file, snippets]) => ({ file, snippets }));
}

/** Modal that shows file snippets grouped by filename, with clickable file headers */
export function SnippetModal({ title, files, onClose }: {
  title: string;
  files: FileSnippet[];
  onClose: () => void;
}) {
  const repoPath = useRepoPath();
  const [fileDiff, setFileDiff] = useState<string | null>(null);
  const [fileDiffPath, setFileDiffPath] = useState("");
  const [defPopover, setDefPopover] = useState<{ symbol: string; filePath: string; position: { x: number; y: number } } | null>(null);

  const grouped = groupSnippetsByFile(files);

  async function openFileDiff(filePath: string) {
    try {
      const diff = await invoke<string>("get_file_diff", { repoPath, file: filePath });
      setFileDiffPath(filePath);
      setFileDiff(diff);
    } catch (e) {
      console.error("Failed to get file diff:", e);
    }
  }

  function handleTokenClick(filePath: string) {
    return (symbol: string, position: { x: number; y: number }) => {
      setDefPopover({ symbol, filePath, position });
    };
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent showCloseButton={false} className="max-w-[95vw] w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="flex flex-row items-start justify-between gap-3 px-4 py-3 border-b border-border shrink-0 space-y-0">
            <DialogTitle className="text-sm text-foreground leading-snug">
              {title}
            </DialogTitle>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground shrink-0" onClick={onClose}>
              <XIcon className="w-4 h-4" />
            </Button>
          </DialogHeader>
          <div className="overflow-auto flex-1 p-0">
            {grouped.map(({ file, snippets }, i) => (
              <div key={i}>
                <button
                  className="flex items-center gap-1.5 w-full px-4 py-2 bg-muted/50 border-b border-t border-border text-xs font-mono text-primary hover:text-primary/80 hover:bg-muted cursor-pointer text-left"
                  onClick={() => openFileDiff(file)}
                  title={`View full diff for ${file}`}
                >
                  <FileCodeIcon className="w-3.5 h-3.5 shrink-0" />
                  {file}
                </button>
                {snippets.map((snippet, j) => (
                  <div key={j} className={j < snippets.length - 1 ? "border-b border-border/50" : ""}>
                    <SnippetBlock snippet={snippet} filePath={file} onTokenClick={handleTokenClick(file)} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      {fileDiff !== null && (
        <DiffModal diff={fileDiff} title={fileDiffPath} onClose={() => { setFileDiff(null); setFileDiffPath(""); }} />
      )}
      {defPopover && repoPath && (
        <DefinitionPopover
          symbol={defPopover.symbol}
          filePath={defPopover.filePath}
          position={defPopover.position}
          onClose={() => setDefPopover(null)}
        />
      )}
    </>
  );
}
