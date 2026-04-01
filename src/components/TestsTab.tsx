import { useState, useCallback } from "react";
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

function changeIcon(type: "added" | "deleted" | "modified" | "unchanged"): string {
  if (type === "added") return "+";
  if (type === "deleted") return "−";
  if (type === "modified") return "Δ";
  return "";
}

function TreeView({ tree, depth, onTestClick }: { tree: TestTree; depth: number; onTestClick: (tc: TestCase) => void }) {
  const indent = depth * 16;
  return (
    <>
      {Array.from(tree.describes.entries()).map(([name, subtree]) => (
        <div key={name}>
          <div className="test-describe" style={{ paddingLeft: indent }}>{name}</div>
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
            className={`test-case${hasSnippet ? " test-case-clickable" : ""}`}
            style={{ paddingLeft: indent }}
            onClick={hasSnippet ? () => onTestClick(tc) : undefined}
          >
            <div className={`test-name test-status-${type}`}>
              {icon && <span className={`test-icon test-icon-${type}`}>{icon}</span>}
              {tc.full_name}
            </div>
            {type !== "added" && (
              <div className={`test-behaviour test-behaviour-${type}`}>{tc.behaviour_change}</div>
            )}
          </div>
        );
      })}
    </>
  );
}

export function TestsTab({ result, loading, hasRepo }: Props) {
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [modalTest, setModalTest] = useState<TestCase | null>(null);

  const toggle = (file: string) =>
    setExpandedFile((prev) => (prev === file ? null : file));

  const onTestClick = useCallback((tc: TestCase) => {
    setModalTest(tc);
  }, []);

  const closeModal = useCallback(() => {
    setModalTest(null);
  }, []);

  if (!hasRepo) return <div className="status empty">Pick a repo folder to analyse tests.</div>;
  if (loading) return (
    <div className="thinking">
      <span className="spinner" />
      Thinking…
    </div>
  );
  if (!result) return null;
  if (result.test_cases.length === 0)
    return <div className="status empty">No test file changes detected.</div>;

  const byFile = new Map<string, { tree: TestTree; cases: TestCase[] }>();
  for (const tc of result.test_cases) {
    if (!byFile.has(tc.file)) byFile.set(tc.file, { tree: makeTree(), cases: [] });
    const entry = byFile.get(tc.file)!;
    insertIntoTree(entry.tree, tc);
    entry.cases.push(tc);
  }

  return (
    <div className="tests-tab">
      {Array.from(byFile.entries()).map(([file, { tree, cases }]) => {
        const isOpen = expandedFile === file;
        const status = fileStatus(cases);
        return (
          <div key={file} className="tests-file-group">
            <button
              className={`tests-file-header file-status-${status}`}
              onClick={() => toggle(file)}
              aria-expanded={isOpen}
            >
              <span className={`summary-chevron${isOpen ? " open" : ""}`}>▸</span>
              {file}
            </button>
            <div className={`tests-file-body${isOpen ? " open" : ""}`}>
              <div className="tests-file-body-inner">
                <TreeView tree={tree} depth={0} onTestClick={onTestClick} />
              </div>
            </div>
          </div>
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
