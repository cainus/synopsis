import { useState, useCallback } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { TestCase, TestsResult } from "../types";
import { DiffModal } from "./DiffModal";

interface Props {
  result: TestsResult | null;
  loading: boolean;
  hasRepo: boolean;
}

interface TestTree {
  describes: Map<string, TestTree>;
  tests: TestCase[];
}

function makeTree(): TestTree {
  return { describes: new Map(), tests: [] };
}

function insertIntoTree(tree: TestTree, tc: TestCase) {
  const parts = tc.full_name.split(" > ");
  const testName = parts[parts.length - 1];
  const describePath = parts.slice(0, -1);
  let node = tree;
  for (const seg of describePath) {
    if (!node.describes.has(seg)) node.describes.set(seg, makeTree());
    node = node.describes.get(seg)!;
  }
  node.tests.push({ ...tc, full_name: testName });
}

function changeType(change: string): "added" | "deleted" | "modified" | "unchanged" {
  if (change === "New test") return "added";
  if (change === "Deleted test") return "deleted";
  if (change === "No behaviour change") return "unchanged";
  return "modified";
}

function fileStatus(cases: TestCase[]): "added" | "deleted" | "modified" {
  const types = cases.map((tc) => changeType(tc.behaviour_change));
  if (types.every((t) => t === "added")) return "added";
  if (types.every((t) => t === "deleted")) return "deleted";
  return "modified";
}

const statusTextColor = {
  added: "text-green-500",
  modified: "text-amber-500",
  deleted: "text-red-400",
  unchanged: "text-muted-foreground",
} as const;

const iconColor = {
  added: "text-green-500",
  modified: "text-amber-500",
  deleted: "text-red-400",
} as const;

function changeIcon(type: "added" | "deleted" | "modified" | "unchanged"): string {
  if (type === "added") return "+";
  if (type === "deleted") return "−";
  if (type === "modified") return "Δ";
  return "";
}

function TreeView({ tree, depth, onTestClick }: { tree: TestTree; depth: number; onTestClick: (tc: TestCase) => void }) {
  return (
    <>
      {Array.from(tree.describes.entries()).map(([name, subtree]) => (
        <div key={name}>
          <div
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 py-1.5 px-3"
            style={{ paddingLeft: depth * 16 + 12 }}
          >
            {name}
          </div>
          <TreeView tree={subtree} depth={depth + 1} onTestClick={onTestClick} />
        </div>
      ))}
      {tree.tests.map((tc, i) => {
        const type = changeType(tc.behaviour_change);
        const icon = changeIcon(type);
        const hasSnippet = !!tc.snippet;
        return (
          <div
            key={i}
            className={`py-2.5 px-3 bg-card rounded mb-1.5 ${hasSnippet ? "cursor-pointer hover:bg-accent" : ""}`}
            style={{ paddingLeft: depth * 16 + 12 }}
            onClick={hasSnippet ? () => onTestClick(tc) : undefined}
          >
            <div className={`flex items-baseline gap-1.5 font-mono text-xs ${statusTextColor[type]} mb-1`}>
              {icon && <span className={`font-bold text-sm shrink-0 w-3 text-center ${iconColor[type as keyof typeof iconColor]}`}>{icon}</span>}
              {tc.full_name}
            </div>
            {type !== "added" && (
              <div className={`text-sm leading-snug ${
                type === "unchanged" ? "text-muted-foreground/50 italic" :
                type === "deleted" ? "text-red-400 italic" :
                type === "modified" ? "text-foreground" :
                "text-green-500 italic"
              }`}>
                {tc.behaviour_change}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

const fileStatusColor = {
  added: "text-green-500",
  modified: "text-amber-500",
  deleted: "text-red-400",
} as const;

export function TestsTab({ result, loading, hasRepo }: Props) {
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [modalTest, setModalTest] = useState<TestCase | null>(null);

  const onTestClick = useCallback((tc: TestCase) => {
    setModalTest(tc);
  }, []);

  const closeModal = useCallback(() => {
    setModalTest(null);
  }, []);

  if (!hasRepo) return <div className="text-muted-foreground/60 py-8 text-center">Pick a repo folder to analyse tests.</div>;
  if (loading) return (
    <div className="flex items-center justify-center gap-2.5 text-muted-foreground py-12 text-sm">
      <span className="inline-block w-3.5 h-3.5 border-2 border-muted border-t-primary rounded-full animate-spin shrink-0" />
      Thinking…
    </div>
  );
  if (!result) return null;
  if (result.test_cases.length === 0)
    return <div className="text-muted-foreground/60 py-8 text-center">No test file changes detected.</div>;

  const byFile = new Map<string, { tree: TestTree; cases: TestCase[] }>();
  for (const tc of result.test_cases) {
    if (!byFile.has(tc.file)) byFile.set(tc.file, { tree: makeTree(), cases: [] });
    const entry = byFile.get(tc.file)!;
    insertIntoTree(entry.tree, tc);
    entry.cases.push(tc);
  }

  return (
    <div className="flex flex-col gap-px">
      {Array.from(byFile.entries()).map(([file, { tree, cases }]) => {
        const isOpen = expandedFile === file;
        const status = fileStatus(cases);
        return (
          <Collapsible
            key={file}
            open={isOpen}
            onOpenChange={() => setExpandedFile(isOpen ? null : file)}
            className="mb-1"
          >
            <CollapsibleTrigger className={`flex items-baseline gap-1.5 w-full bg-card rounded py-2 px-2.5 font-mono text-[11px] ${fileStatusColor[status]} hover:bg-accent text-left border-none cursor-pointer`}>
              <span className={`text-muted-foreground/50 text-[11px] shrink-0 w-2.5 inline-block transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}>
                ▸
              </span>
              {file}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <TreeView tree={tree} depth={0} onTestClick={onTestClick} />
            </CollapsibleContent>
          </Collapsible>
        );
      })}
      {modalTest && (
        <DiffModal
          diff={modalTest.snippet}
          title={`${modalTest.file} — ${modalTest.full_name}`}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
