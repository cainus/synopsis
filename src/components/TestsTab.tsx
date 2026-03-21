import type { TestsResult } from "../types";

interface Props {
  result: TestsResult | null;
  loading: boolean;
  hasRepo: boolean;
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

  // Group by file, preserving insertion order
  const byFile = new Map<string, typeof result.test_cases>();
  for (const tc of result.test_cases) {
    const group = byFile.get(tc.file) ?? [];
    group.push(tc);
    byFile.set(tc.file, group);
  }

  return (
    <div className="tests-tab">
      {Array.from(byFile.entries()).map(([file, cases]) => (
        <div key={file} className="tests-file-group">
          <div className="tests-file-header">{file}</div>
          {cases.map((tc, i) => (
            <div key={i} className="test-case">
              <div className="test-name">{tc.full_name}</div>
              <div
                className={
                  "test-behaviour" +
                  (tc.behaviour_change === "No behaviour change" ? " no-change" : "") +
                  (tc.behaviour_change === "New test" ? " new-test" : "")
                }
              >
                {tc.behaviour_change}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
