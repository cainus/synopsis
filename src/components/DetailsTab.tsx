import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { DetailsResult, SummaryChangeItem } from "../types";
import { DiffModal } from "./DiffModal";

interface Props {
  result: DetailsResult | null;
  loading: boolean;
  hasRepo: boolean;
  onGenerate: () => void;
}

function SnippetLink({ item, onShowSnippet }: { item: SummaryChangeItem; onShowSnippet: (file: string, snippet: string) => void }) {
  if (!item.file) return null;
  return (
    <button
      className="text-primary text-[11px] font-mono hover:underline hover:text-primary/80 px-0.5 bg-transparent border-none cursor-pointer"
      onClick={(e) => { e.stopPropagation(); onShowSnippet(item.file, item.snippet); }}
    >
      {item.file.split("/").pop()}
    </button>
  );
}

function CollapsibleNode({ item, depth, onShowSnippet }: { item: SummaryChangeItem; depth: number; onShowSnippet: (file: string, snippet: string) => void }) {
  const [open, setOpen] = useState(false);
  const hasChildren = item.children.length > 0;
  const isNested = depth > 0;
  const textColor = isNested ? "text-muted-foreground/70" : "text-muted-foreground";
  const textSize = isNested ? "text-xs" : "text-sm";

  if (!hasChildren) {
    return (
      <li className="py-0.5">
        <span className={`${textSize} leading-relaxed ${textColor}`}>
          <span className="text-muted-foreground/40 mr-1.5">–</span>
          {item.title}
          <SnippetLink item={item} onShowSnippet={onShowSnippet} />
        </span>
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
          <SnippetLink item={item} onShowSnippet={onShowSnippet} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="pl-4 space-y-0">
            {item.children.map((child, i) => (
              <CollapsibleNode key={i} item={child} depth={depth + 1} onShowSnippet={onShowSnippet} />
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
  onShowSnippet,
}: {
  items: SummaryChangeItem[];
  label: string;
  prefix: string;
  expandedKey: string | null;
  onToggle: (key: string) => void;
  onShowSnippet: (file: string, snippet: string) => void;
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
          return (
            <li key={i} className="mb-0.5">
              <Collapsible open={isOpen} onOpenChange={() => onToggle(key)}>
                <CollapsibleTrigger className="flex items-baseline gap-1.5 w-full py-2 px-2.5 bg-card rounded text-sm leading-snug text-foreground/90 hover:bg-accent text-left border-none cursor-pointer">
                  <span className={`text-muted-foreground/50 text-[11px] shrink-0 w-2.5 inline-block transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}>
                    {hasChildren ? "▸" : "·"}
                  </span>
                  {item.title}
                  <SnippetLink item={item} onShowSnippet={onShowSnippet} />
                </CollapsibleTrigger>
                {hasChildren && (
                  <CollapsibleContent className="pl-6 pr-2.5 py-1">
                    <ul className="space-y-0">
                      {item.children.map((child, j) => (
                        <CollapsibleNode key={j} item={child} depth={1} onShowSnippet={onShowSnippet} />
                      ))}
                    </ul>
                  </CollapsibleContent>
                )}
              </Collapsible>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DetailsTab({ result, loading, hasRepo, onGenerate }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [modalFile, setModalFile] = useState<string | null>(null);
  const [modalSnippet, setModalSnippet] = useState("");

  const toggle = (key: string) =>
    setExpandedKey((prev) => (prev === key ? null : key));

  const showSnippet = useCallback((file: string, snippet: string) => {
    setModalFile(file);
    setModalSnippet(snippet);
  }, []);

  const closeModal = useCallback(() => {
    setModalFile(null);
    setModalSnippet("");
  }, []);

  if (!hasRepo) return <div className="text-muted-foreground/60 py-8 text-center">Pick a repo folder to generate details.</div>;

  if (!loading && !result) {
    return (
      <div className="flex justify-center py-12">
        <Button onClick={onGenerate}>Generate Details</Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2.5 text-muted-foreground py-12 text-sm">
        <span className="inline-block w-3.5 h-3.5 border-2 border-muted border-t-primary rounded-full animate-spin shrink-0" />
        Thinking…
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="max-w-[780px]">
      <TopLevelList items={result.product_changes} label="Product Changes" prefix="product" expandedKey={expandedKey} onToggle={toggle} onShowSnippet={showSnippet} />
      <TopLevelList items={result.technical_changes} label="Technical Changes" prefix="technical" expandedKey={expandedKey} onToggle={toggle} onShowSnippet={showSnippet} />
      {modalFile !== null && (
        <DiffModal diff={modalSnippet} title={modalFile} onClose={closeModal} />
      )}
    </div>
  );
}
