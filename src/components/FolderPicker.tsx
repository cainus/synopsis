import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface Props {
  repoPath: string | null;
  onPick: (path: string) => void;
  onRefresh: () => void;
  recentPaths: string[];
}

export function FolderPicker({ repoPath, onPick, onRefresh, recentPaths }: Props) {
  const [recentsOpen, setRecentsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unlisten = listen<string | null>("folder-picked", (event) => {
      if (event.payload) onPick(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [onPick]);

  useEffect(() => {
    if (!recentsOpen) return;
    function handleClick(e: MouseEvent) {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setRecentsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [recentsOpen]);

  function handleClick() {
    invoke("pick_folder").catch(console.error);
  }

  function handleSelectRecent(path: string) {
    setRecentsOpen(false);
    onPick(path);
  }

  // Recents excluding the current path
  const otherRecents = recentPaths.filter((p) => p !== repoPath);

  return (
    <div className="folder-picker">
      <button onClick={handleClick}>Choose Repo Folder</button>
      {otherRecents.length > 0 && (
        <div className="recents-dropdown" ref={dropdownRef}>
          <button
            className="recents-btn"
            onClick={() => setRecentsOpen((o) => !o)}
            title="Recent folders"
          >
            Recent ▾
          </button>
          {recentsOpen && (
            <ul className="recents-list">
              {otherRecents.map((p) => (
                <li key={p}>
                  <button onClick={() => handleSelectRecent(p)} title={p}>
                    {p}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {repoPath && (
        <>
          <span className="folder-path">{repoPath}</span>
          <button className="refresh-btn" onClick={onRefresh} title="Refresh">↺</button>
        </>
      )}
    </div>
  );
}
