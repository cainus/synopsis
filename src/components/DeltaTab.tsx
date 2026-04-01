import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DeltaResult } from "../types";
import { DiffModal } from "./DiffModal";

interface Props {
  result: DeltaResult | null;
  loading: boolean;
  repoPath: string | null;
}

export function DeltaTab({ result, loading, repoPath }: Props) {
  const [modalDiff, setModalDiff] = useState<string | null>(null);
  const [modalFile, setModalFile] = useState("");

  const openFile = useCallback(async (path: string) => {
    if (!repoPath) return;
    try {
      const diff = await invoke<string>("get_file_diff", { repoPath, file: path });
      setModalFile(path);
      setModalDiff(diff);
    } catch (e) {
      console.error("Failed to get diff:", e);
    }
  }, [repoPath]);

  const closeModal = useCallback(() => {
    setModalDiff(null);
    setModalFile("");
  }, []);

  if (loading) return <div className="status">Loading diff…</div>;
  if (!result) return <div className="status empty">Pick a repo folder to see changes.</div>;
  const onDefaultBranch = result.current_branch === result.default_branch;

  if (result.files.length === 0)
    return (
      <div className="status empty">
        {onDefaultBranch
          ? <>No uncommitted changes on <code>{result.default_branch}</code>.</>
          : <>No changes vs <code>{result.default_branch}</code>.</>}
      </div>
    );

  const totalAdded = result.files.reduce((s, f) => s + f.added, 0);
  const totalRemoved = result.files.reduce((s, f) => s + f.removed, 0);

  return (
    <div className="delta-tab">
      <div className="branch-label">
        {onDefaultBranch
          ? <>Uncommitted changes on <code>{result.current_branch}</code></>
          : <>Changes vs <code>{result.default_branch}</code></>}
      </div>
      <table className="delta-table">
        <thead>
          <tr>
            <th>File</th>
            <th></th>
            <th>Added</th>
            <th>Removed</th>
          </tr>
        </thead>
        <tbody>
          {result.files.map((f) => (
            <tr key={f.path} className="delta-row" onClick={() => openFile(f.path)}>
              <td className={`file-path file-status-${f.status}`}>{f.path}</td>
              <td className="file-badge-cell">
                <span className={`file-badge ${f.untracked ? "badge-untracked" : "badge-tracked"}`}>
                  {f.untracked ? "untracked" : "tracked"}
                </span>
              </td>
              <td className="added">+{f.added}</td>
              <td className="removed">-{f.removed}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="total-label" colSpan={2}>Total ({result.files.length} files)</td>
            <td className="added">+{totalAdded}</td>
            <td className="removed">-{totalRemoved}</td>
          </tr>
        </tfoot>
      </table>
      {modalDiff !== null && (
        <DiffModal diff={modalDiff} title={modalFile} onClose={closeModal} />
      )}
    </div>
  );
}
