import { useState, useCallback, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CodeXmlIcon, FileCodeIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHighlighter } from "@/hooks/useHighlighter";
import { HighlightedLine } from "./HighlightedLine";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DetailsResult, SummaryChangeItem, FileSnippet } from "../types";
import { DiffModal } from "./DiffModal";
import { DefinitionPopover } from "./DefinitionPopover";

interface Props {
  result: DetailsResult | null;
  loading: boolean;
  hasRepo: boolean;
  onGenerate: () => void;
  repoPath: string | null;
}

function CodeButton({ item, onShowFiles }: { item: SummaryChangeItem; onShowFiles: (title: string, files: FileSnippet[]) => void }) {
  if (!item.files || item.files.length === 0) return null;
  return (
    <button
      className="inline-flex items-center justify-center ml-1.5 text-primary/60 hover:text-primary bg-transparent border-none cursor-pointer p-0 shrink-0"
      onClick={(e) => { e.stopPropagation(); onShowFiles(item.title, item.files); }}
      title="View code changes"
    >
      <CodeXmlIcon className="w-3.5 h-3.5" />
    </button>
  );
}

function CollapsibleNode({ item, depth, onShowFiles }: { item: SummaryChangeItem; depth: number; onShowFiles: (title: string, files: FileSnippet[]) => void }) {
  const [open, setOpen] = useState(false);
  const hasChildren = item.children.length > 0;
  const isNested = depth > 0;
  const textColor = isNested ? "text-muted-foreground/70" : "text-muted-foreground";
  const textSize = isNested ? "text-xs" : "text-sm";

  if (!hasChildren) {
    const hasFiles = item.files && item.files.length > 0;
    return (
      <li className="py-0.5">
        {hasFiles ? (
          <button
            className={`${textSize} leading-relaxed ${textColor} hover:text-foreground/80 inline-flex items-baseline gap-0 bg-transparent border-none cursor-pointer p-0 text-left`}
            onClick={() => onShowFiles(item.title, item.files)}
          >
            <span className="text-muted-foreground/40 mr-1.5">–</span>
            {item.title}
            <CodeXmlIcon className="w-3 h-3 ml-1.5 text-primary/40 shrink-0 relative top-[1px]" />
          </button>
        ) : (
          <span className={`${textSize} leading-relaxed ${textColor} inline-flex items-baseline gap-0`}>
            <span className="text-muted-foreground/40 mr-1.5">–</span>
            {item.title}
          </span>
        )}
      </li>
    );
  }

  return (
    <li className="py-0.5">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className={`flex items-baseline gap-1.5 w-full ${textSize} leading-relaxed ${textColor} hover:text-foreground/80 text-left bg-transparent border-none cursor-pointer p-0`}>
          <span className={`text-muted-foreground/50 text-[11px] shrink-0 w-2.5 inline-block transition-transform duration-150 ${open ? "rotate-90" : ""}`}>
            ▸
          </span>
          {item.title}
          <CodeButton item={item} onShowFiles={onShowFiles} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="pl-4 space-y-0">
            {item.children.map((child, i) => (
              <CollapsibleNode key={i} item={child} depth={depth + 1} onShowFiles={onShowFiles} />
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

function TopLevelList({
  items,
  label,
  prefix,
  expandedKey,
  onToggle,
  onShowFiles,
}: {
  items: SummaryChangeItem[];
  label: string;
  prefix: string;
  expandedKey: string | null;
  onToggle: (key: string) => void;
  onShowFiles: (title: string, files: FileSnippet[]) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mb-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">{label}</h3>
      <ul className="space-y-0.5">
        {items.map((item, i) => {
          const key = `${prefix}-${i}`;
          const isOpen = expandedKey === key;
          const hasChildren = item.children.length > 0;
          const hasFiles = item.files && item.files.length > 0;
          const isLeafWithFiles = !hasChildren && hasFiles;
          return (
            <li key={i} className="mb-0.5">
              {isLeafWithFiles ? (
                <button
                  className="flex items-baseline gap-1.5 w-full py-2 px-2.5 bg-card rounded text-sm leading-snug text-foreground/90 hover:bg-accent text-left border-none cursor-pointer"
                  onClick={() => onShowFiles(item.title, item.files)}
                >
                  <span className="text-muted-foreground/50 text-[11px] shrink-0 w-2.5 inline-block">·</span>
                  {item.title}
                  <CodeXmlIcon className="w-3.5 h-3.5 ml-1.5 text-primary/40 shrink-0" />
                </button>
              ) : (
                <Collapsible open={isOpen} onOpenChange={() => onToggle(key)}>
                  <CollapsibleTrigger className="flex items-baseline gap-1.5 w-full py-2 px-2.5 bg-card rounded text-sm leading-snug text-foreground/90 hover:bg-accent text-left border-none cursor-pointer">
                    <span className={`text-muted-foreground/50 text-[11px] shrink-0 w-2.5 inline-block transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}>
                      {hasChildren ? "▸" : "·"}
                    </span>
                    {item.title}
                    <CodeButton item={item} onShowFiles={onShowFiles} />
                  </CollapsibleTrigger>
                  {hasChildren && (
                    <CollapsibleContent className="pl-6 pr-2.5 py-1">
                      <ul className="space-y-0">
                        {item.children.map((child, j) => (
                          <CollapsibleNode key={j} item={child} depth={1} onShowFiles={onShowFiles} />
                        ))}
                      </ul>
                    </CollapsibleContent>
                  )}
                </Collapsible>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Inline snippet renderer — just the diff lines, no modal chrome */
function SnippetBlock({ snippet, filePath, onTokenClick }: { snippet: string; filePath: string; onTokenClick?: (symbol: string, position: { x: number; y: number }) => void }) {
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

  function bgFor(line: string): string {
    if (line.startsWith("+")) return "bg-green-500/8";
    if (line.startsWith("-")) return "bg-red-400/8";
    return "";
  }

  function classFor(line: string): string {
    if (line.startsWith("+")) return "text-green-500 bg-green-500/8";
    if (line.startsWith("-")) return "text-red-400 bg-red-400/8";
    return "";
  }

  return (
    <pre className="m-0 font-mono text-xs leading-relaxed text-muted-foreground whitespace-pre tab-[4]">
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

/** Modal that shows file snippets grouped by filename, with clickable file headers */
function SnippetModal({ title, files, repoPath, onClose }: {
  title: string;
  files: FileSnippet[];
  repoPath: string | null;
  onClose: () => void;
}) {
  const [fileDiff, setFileDiff] = useState<string | null>(null);
  const [fileDiffPath, setFileDiffPath] = useState("");
  const [defPopover, setDefPopover] = useState<{ symbol: string; filePath: string; position: { x: number; y: number } } | null>(null);

  const grouped = groupSnippetsByFile(files);

  async function openFileDiff(filePath: string) {
    if (!repoPath) return;
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
      if (repoPath) {
        setDefPopover({ symbol, filePath, position });
      }
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
                    <SnippetBlock snippet={snippet} filePath={file} onTokenClick={repoPath ? handleTokenClick(file) : undefined} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      {fileDiff !== null && (
        <DiffModal diff={fileDiff} title={fileDiffPath} onClose={() => { setFileDiff(null); setFileDiffPath(""); }} repoPath={repoPath} />
      )}
      {defPopover && repoPath && (
        <DefinitionPopover
          symbol={defPopover.symbol}
          filePath={defPopover.filePath}
          repoPath={repoPath}
          position={defPopover.position}
          onClose={() => setDefPopover(null)}
        />
      )}
    </>
  );
}

export function DetailsTab({ result, loading, hasRepo, onGenerate, repoPath }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState<string | null>(null);
  const [modalFiles, setModalFiles] = useState<FileSnippet[]>([]);

  const toggle = (key: string) =>
    setExpandedKey((prev) => (prev === key ? null : key));

  const showFiles = useCallback((title: string, files: FileSnippet[]) => {
    setModalTitle(title);
    setModalFiles(files);
  }, []);

  const closeModal = useCallback(() => {
    setModalTitle(null);
    setModalFiles([]);
  }, []);

  useEffect(() => {
    if (hasRepo && !loading && !result) onGenerate();
  }, [hasRepo, loading, result, onGenerate]);

  if (!hasRepo) return <div className="text-muted-foreground/60 py-8 text-center">Pick a repo folder to generate details.</div>;

  if (!result) {
    return (
      <div className="flex items-center justify-center gap-2.5 text-muted-foreground py-12 text-sm">
        <span className="inline-block w-3.5 h-3.5 border-2 border-muted border-t-primary rounded-full animate-spin shrink-0" />
        Thinking…
      </div>
    );
  }

  return (
    <div className="max-w-[780px]">
      <TopLevelList items={result.product_changes} label="Product Changes" prefix="product" expandedKey={expandedKey} onToggle={toggle} onShowFiles={showFiles} />
      <TopLevelList items={result.technical_changes} label="Technical Changes" prefix="technical" expandedKey={expandedKey} onToggle={toggle} onShowFiles={showFiles} />
      {modalTitle !== null && (
        <SnippetModal title={modalTitle} files={modalFiles} repoPath={repoPath} onClose={closeModal} />
      )}
    </div>
  );
}

/** Group FileSnippet[] by file path */
function groupSnippetsByFile(files: FileSnippet[]): { file: string; snippets: string[] }[] {
  const map = new Map<string, string[]>();
  for (const fs of files) {
    if (!map.has(fs.file)) map.set(fs.file, []);
    map.get(fs.file)!.push(fs.snippet);
  }
  return Array.from(map.entries()).map(([file, snippets]) => ({ file, snippets }));
}
