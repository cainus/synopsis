import { useState, useCallback, useEffect } from "react";
import { CodeXmlIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { DetailsResult, SummaryChangeItem, FileSnippet } from "../types";
import { SnippetModal } from "./SnippetModal";
import { ThinkingSpinner } from "./ThinkingSpinner";

interface Props {
  result: DetailsResult | null;
  loading: boolean;
  hasRepo: boolean;
  onGenerate: () => void;
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

export function DetailsTab({ result, loading, hasRepo, onGenerate }: Props) {
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
      <ThinkingSpinner />
    );
  }

  return (
    <div className="max-w-[780px]">
      <TopLevelList items={result.product_changes} label="Product Changes" prefix="product" expandedKey={expandedKey} onToggle={toggle} onShowFiles={showFiles} />
      <TopLevelList items={result.technical_changes} label="Technical Changes" prefix="technical" expandedKey={expandedKey} onToggle={toggle} onShowFiles={showFiles} />
      {modalTitle !== null && (
        <SnippetModal title={modalTitle} files={modalFiles} onClose={closeModal} />
      )}
    </div>
  );
}
