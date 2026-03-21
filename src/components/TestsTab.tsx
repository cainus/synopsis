import type { TestsResult } from "../types";

interface Props {
  result: TestsResult | null;
  loading: boolean;
  hasRepo: boolean;
}

export function TestsTab({ result, loading, hasRepo }: Props) {
  if (!hasRepo) return <div className="status empty">Pick a repo folder to analyse tests.</div>;
  if (loading) return <div className="status">Analysing test changes with Claude…</div>;
  if (!result) return null;
  if (result.test_cases.length === 0)
    return <div className="status empty">No test file changes detected.</div>;

  return (
    <div className="tests-tab">
      {result.test_cases.map((tc, i) => (
        <div key={i} className="test-case">
          <div className="test-name">{tc.full_name}</div>
          <div
            className={
              "test-behaviour" +
              (tc.behaviour_change === "No behaviour change" ? " no-change" : "")
            }
          >
            {tc.behaviour_change}
          </div>
        </div>
      ))}
    </div>
  );
}
