import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { DeltaResult } from "../types";
import { DiffModal } from "./DiffModal";
import { useRepoPath } from "@/contexts/RepoContext";

interface Props {
  result: DeltaResult | null;
  loading: boolean;
}

const statusColor = {
  added: "text-green-500",
  modified: "text-amber-500",
  deleted: "text-red-400",
} as const;

export function DeltaTab({ result, loading }: Props) {
  const repoPath = useRepoPath();
  const [modalDiff, setModalDiff] = useState<string | null>(null);
  const [modalFile, setModalFile] = useState("");

  const openFile = useCallback(async (path: string) => {
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

  if (loading) return <div className="text-muted-foreground py-8 text-center">Loading diff…</div>;
  if (!result) return <div className="text-muted-foreground/60 py-8 text-center">Pick a repo folder to see changes.</div>;
  const onDefaultBranch = result.current_branch === result.default_branch;

  if (result.files.length === 0)
    return (
      <div className="text-muted-foreground/60 py-8 text-center">
        {onDefaultBranch
          ? <>No uncommitted changes on <code className="text-muted-foreground">{result.default_branch}</code>.</>
          : <>No changes vs <code className="text-muted-foreground">{result.default_branch}</code>.</>}
      </div>
    );

  const totalAdded = result.files.reduce((s, f) => s + f.added, 0);
  const totalRemoved = result.files.reduce((s, f) => s + f.removed, 0);

  return (
    <div className="max-w-[900px]">
      <div className="text-muted-foreground text-xs mb-3">
        {onDefaultBranch
          ? <>Uncommitted changes on <code className="text-muted-foreground/80">{result.current_branch}</code></>
          : <>Changes vs <code className="text-muted-foreground/80">{result.default_branch}</code></>}
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs uppercase tracking-wide">File</TableHead>
            <TableHead className="text-xs uppercase tracking-wide w-1"></TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-right w-20">Added</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-right w-20">Removed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.files.map((f) => (
            <TableRow key={f.path} className="cursor-pointer" onClick={() => openFile(f.path)}>
              <TableCell className={`font-mono text-sm ${statusColor[f.status]}`}>{f.path}</TableCell>
              <TableCell className="whitespace-nowrap pr-3">
                <Badge variant={f.untracked ? "outline" : "secondary"} className="text-[0.65rem] font-semibold uppercase tracking-wide">
                  {f.untracked ? "untracked" : "tracked"}
                </Badge>
              </TableCell>
              <TableCell className="text-right text-green-500 font-mono text-sm">+{f.added}</TableCell>
              <TableCell className="text-right text-red-400 font-mono text-sm">-{f.removed}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2} className="text-muted-foreground text-xs">
              Total ({result.files.length} files)
            </TableCell>
            <TableCell className="text-right text-green-500 font-mono text-sm">+{totalAdded}</TableCell>
            <TableCell className="text-right text-red-400 font-mono text-sm">-{totalRemoved}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
      {modalDiff !== null && (
        <DiffModal diff={modalDiff} title={modalFile} onClose={closeModal} />
      )}
    </div>
  );
}
