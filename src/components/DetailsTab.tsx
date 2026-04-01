import { useState, useCallback } from "react";
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
      className="summary-file-link"
      onClick={(e) => { e.stopPropagation(); onShowSnippet(item.file, item.snippet); }}
    >
      {item.file.split("/").pop()}
    </button>
  );
}

function CollapsibleNode({ item, depth, onShowSnippet }: { item: SummaryChangeItem; depth: number; onShowSnippet: (file: string, snippet: string) => void }) {
  const [open, setOpen] = useState(false);
  const hasChildren = item.children.length > 0;
  const isTopLevel = depth === 0;
  const nodeClass = isTopLevel ? "summary-change-item" : "summary-tree-node";
  const labelClass = isTopLevel ? "summary-change-toggle" : "summary-tree-toggle";

  if (!hasChildren) {
    return (
      <li className={nodeClass}>
        {isTopLevel ? (
          <div className={labelClass}>
            <span className="summary-chevron">·</span>
            {item.title}
            <SnippetLink item={item} onShowSnippet={onShowSnippet} />
          </div>
        ) : (
          <span className="summary-tree-label">
            {item.title}
            <SnippetLink item={item} onShowSnippet={onShowSnippet} />
          </span>
        )}
      </li>
    );
  }

  return (
    <li className={nodeClass}>
      <button
        className={labelClass}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className={`summary-chevron${open ? " open" : ""}`}>▸</span>
        {item.title}
        <SnippetLink item={item} onShowSnippet={onShowSnippet} />
      </button>
      <div className={`summary-collapse${open ? " open" : ""}${isTopLevel ? " summary-collapse-top" : ""}`}>
        <div className="summary-collapse-inner">
          <ul className={isTopLevel ? "summary-tree" : "summary-tree summary-tree-nested"}>
            {item.children.map((child, i) => (
              <CollapsibleNode key={i} item={child} depth={depth + 1} onShowSnippet={onShowSnippet} />
            ))}
          </ul>
        </div>
      </div>
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
    <div className="summary-section">
      <h3 className="summary-section-label">{label}</h3>
      <ul className="summary-change-list">
        {items.map((item, i) => {
          const key = `${prefix}-${i}`;
          const isOpen = expandedKey === key;
          const hasChildren = item.children.length > 0;
          return (
            <li key={i} className="summary-change-item">
              <button
                className="summary-change-toggle"
                onClick={() => onToggle(key)}
                aria-expanded={isOpen}
              >
                <span className={`summary-chevron${isOpen ? " open" : ""}`}>{hasChildren ? "▸" : "·"}</span>
                {item.title}
                <SnippetLink item={item} onShowSnippet={onShowSnippet} />
              </button>
              {hasChildren && (
                <div className={`summary-collapse summary-collapse-top${isOpen ? " open" : ""}`}>
                  <div className="summary-collapse-inner">
                    <ul className="summary-tree">
                      {item.children.map((child, j) => (
                        <CollapsibleNode key={j} item={child} depth={1} onShowSnippet={onShowSnippet} />
                      ))}
                    </ul>
                  </div>
                </div>
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

  if (!hasRepo) return <div className="status empty">Pick a repo folder to generate details.</div>;

  if (!loading && !result) {
    return (
      <div className="generate-prompt">
        <button onClick={onGenerate}>Generate Details</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="thinking">
        <span className="spinner" />
        Thinking…
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="summary-tab">
      <TopLevelList items={result.product_changes} label="Product Changes" prefix="product" expandedKey={expandedKey} onToggle={toggle} onShowSnippet={showSnippet} />
      <TopLevelList items={result.technical_changes} label="Technical Changes" prefix="technical" expandedKey={expandedKey} onToggle={toggle} onShowSnippet={showSnippet} />
      {modalFile !== null && (
        <DiffModal diff={modalSnippet} title={modalFile} onClose={closeModal} />
      )}
    </div>
  );
}
