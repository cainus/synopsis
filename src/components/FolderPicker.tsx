import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  repoPath: string | null;
  onPick: (path: string) => void;
  onRefresh: () => void;
  recentPaths: string[];
}

export function FolderPicker({ repoPath, onPick, onRefresh, recentPaths }: Props) {
  const [recentsOpen, setRecentsOpen] = useState(false);

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

  function handleSelectRecent(path: string) {
    setRecentsOpen(false);
    onPick(path);
  }

  const otherRecents = recentPaths.filter((p) => p !== repoPath);

  return (
    <div className="flex items-center gap-2.5 flex-1">
      <Button variant="secondary" size="sm" onClick={handleClick}>
        Choose Repo Folder
      </Button>
      {otherRecents.length > 0 && (
        <DropdownMenu open={recentsOpen} onOpenChange={setRecentsOpen}>
          <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer">
            Recent ▾
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[280px] max-w-[480px]">
            {otherRecents.map((p) => (
              <DropdownMenuItem
                key={p}
                onClick={() => handleSelectRecent(p)}
                className="font-mono text-xs truncate"
              >
                {p}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {repoPath && (
        <>
          <span className="text-muted-foreground text-xs font-mono truncate overflow-hidden">
            {repoPath}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onRefresh} title="Refresh">
            ↺
          </Button>
        </>
      )}
    </div>
  );
}
