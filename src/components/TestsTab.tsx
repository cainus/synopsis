import type { TestCase, TestsResult } from "../types";

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

function behaviourClass(change: string) {
  if (change === "No behaviour change") return "test-behaviour no-change";
  if (change === "New test") return "test-behaviour new-test";
  return "test-behaviour";
}

function renderTree(tree: TestTree, depth = 0): React.ReactNode {
  const indent = depth * 16;
  return (
    <>
      {Array.from(tree.describes.entries()).map(([name, subtree]) => (
        <div key={name}>
          <div className="test-describe" style={{ paddingLeft: indent }}>{name}</div>
          {renderTree(subtree, depth + 1)}
        </div>
      ))}
      {tree.tests.map((tc, i) => (
        <div key={i} className="test-case" style={{ paddingLeft: indent }}>
          <div className="test-name">{tc.full_name}</div>
          <div className={behaviourClass(tc.behaviour_change)}>{tc.behaviour_change}</div>
        </div>
      ))}
    </>
  );
}

export function TestsTab({ result, loading, hasRepo }: Props) {
  if (!hasRepo) return <div className="status empty">Pick a repo folder to analyse tests.</div>;
  if (loading) return (
    <div className="thinking">
      <span className="spinner" />
      Claude is thinking…
    </div>
  );
  if (!result) return null;
  if (result.test_cases.length === 0)
    return <div className="status empty">No test file changes detected.</div>;

  const byFile = new Map<string, TestTree>();
  for (const tc of result.test_cases) {
    if (!byFile.has(tc.file)) byFile.set(tc.file, makeTree());
    insertIntoTree(byFile.get(tc.file)!, tc);
  }

  return (
    <div className="tests-tab">
      {Array.from(byFile.entries()).map(([file, tree]) => (
        <div key={file} className="tests-file-group">
          <div className="tests-file-header">{file}</div>
          {renderTree(tree)}
        </div>
      ))}
    </div>
  );
}
