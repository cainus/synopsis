import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface Props {
  repoPath: string | null;
  onPick: (path: string) => void;
  onRefresh: () => void;
}

export function FolderPicker({ repoPath, onPick, onRefresh }: Props) {
  useEffect(() => {
    const unlisten = listen<string | null>("folder-picked", (event) => {
      if (event.payload) onPick(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [onPick]);

  function handleClick() {
    invoke("pick_folder").catch(console.error);
  }

  return (
    <div className="folder-picker">
      <button onClick={handleClick}>Choose Repo Folder</button>
      {repoPath && (
        <>
          <span className="folder-path">{repoPath}</span>
          <button className="refresh-btn" onClick={onRefresh} title="Refresh">↺</button>
        </>
      )}
    </div>
  );
}
