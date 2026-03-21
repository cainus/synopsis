import type { DeltaResult } from "../types";

interface Props {
  result: DeltaResult | null;
  loading: boolean;
}

export function DeltaTab({ result, loading }: Props) {
  if (loading) return <div className="status">Loading diff…</div>;
  if (!result) return <div className="status empty">Pick a repo folder to see changes.</div>;
  if (result.files.length === 0)
    return (
      <div className="status empty">
        No changes vs <code>{result.default_branch}</code>.
      </div>
    );

  const totalAdded = result.files.reduce((s, f) => s + f.added, 0);
  const totalRemoved = result.files.reduce((s, f) => s + f.removed, 0);

  return (
    <div className="delta-tab">
      <div className="branch-label">
        Changes vs <code>{result.default_branch}</code>
      </div>
      <table className="delta-table">
        <thead>
          <tr>
            <th>File</th>
            <th>Added</th>
            <th>Removed</th>
          </tr>
        </thead>
        <tbody>
          {result.files.map((f) => (
            <tr key={f.path}>
              <td className="file-path">{f.path}</td>
              <td className="added">+{f.added}</td>
              <td className="removed">-{f.removed}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="total-label">Total ({result.files.length} files)</td>
            <td className="added">+{totalAdded}</td>
            <td className="removed">-{totalRemoved}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
