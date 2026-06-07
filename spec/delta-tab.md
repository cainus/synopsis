# Delta Tab

The Delta tab shows which files changed, and how many lines were added or removed in each. What "changed" means depends on context:

- **On a feature branch:** files changed vs the default branch
- **On the default branch:** uncommitted and untracked changes

## Display

Each changed file is shown as a table row:

```
File                       Status     Added   Removed
src/components/App.tsx     tracked    +24     -3
src/hooks/useRepo.ts       tracked    +11     -0
src/types.ts               untracked  +8      -0
─────────────────────────────────────────────────────
Total (3 files)                       +43     -3
```

- File names are coloured by status: **green** for added, **yellow** for modified, **red** for deleted
- Each file has a badge showing "tracked" or "untracked"
- Added line counts are green
- Removed line counts are red
- A totals row at the bottom sums all files
- Rows are clickable — clicking opens a diff modal showing the full file diff with inline/side-by-side toggle

### File status detection

File status is determined via `git diff --name-status <default-branch>`:
- `A` → added (green)
- `D` → deleted (red)
- All others → modified (yellow)

Untracked files (on default branch only) are always classified as "added".

## Git commands

**Diff stats:**
```
git diff --numstat --no-renames <default-branch>
```

**File statuses:**
```
git diff --name-status --no-renames <default-branch>
```

A two-dot (working-tree) diff is used so that staged and unstaged local changes are included, and so that changes are visible even when HEAD is the default branch itself (e.g. working directly on main).

`--no-renames` is used to disable git's rename detection. Without it, renamed files produce mangled paths like `src/models/{old.ts => new.ts}` which break file-click diffs (the path doesn't exist on disk). With `--no-renames`, renames appear as two clean entries — one deleted, one added — with real file paths that work correctly when clicked.

**Untracked files** (when on default branch only):
```
git ls-files --others --exclude-standard
```

Untracked files are counted by reading the file and counting lines.

## Diff modal

Clicking a file row calls `get_file_diff(repo_path, file)` which runs `git diff <default-branch> -- <file>` and returns the raw diff text. The shared `DiffModal` component renders it with:

- **Inline view** (default): standard unified diff with colour-coded lines
- **Side-by-side view**: left pane (old), right pane (new), paired by consecutive remove/add blocks
- **Current view**: full current file contents (working tree state) with syntax highlighting and line numbers, no diff markup or line highlights. Fetches file via `get_file_content(repo_path, file)` which reads the file from disk. Shows "File not found" for deleted files. Click-to-definition works in this view.
- Toggle via buttons in the modal header
- Closes on Escape or backdrop click

### Text search (Cmd+F / Ctrl+F)

The diff modal supports text search with keyboard shortcut activation:

- **Open:** Press Cmd+F (Mac) or Ctrl+F (Windows/Linux) while the modal is open. The browser's built-in find dialog is suppressed via `preventDefault`.
- **Search bar:** Appears between the header and the diff content. Contains a text input (auto-focused), match count display ("N of M"), up/down navigation arrows, and a close (X) button.
- **Matching:** Case-insensitive substring search against the code content of each line (prefix-stripped — the `+`/`-`/space diff prefix and line numbers are excluded from matching).
- **Highlighting:** All matching lines get `bg-yellow-500/20`. The current (active) match gets `bg-yellow-500/40` and is scrolled into view.
- **Navigation:** Enter goes to next match, Shift+Enter goes to previous. Up/down arrow buttons also navigate. Navigation wraps around at boundaries.
- **Close:** Clicking the X button or pressing Escape while the search input is focused closes the search bar (not the modal). Pressing Cmd+F again while search is open re-focuses the input.
- **View modes:** Search works in all three views (inline, side-by-side, and current). In current view, `CurrentFileView` handles search highlighting internally and reports match count back to the modal.

## Empty states

- **No repo selected:** prompt to pick a folder
- **On feature branch, no changes:** "No changes vs `<default-branch>`"
- **On default branch, no uncommitted changes:** "No uncommitted changes on `<default-branch>`"
- **Loading:** shown while the git command runs
