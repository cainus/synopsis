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
- Toggle via buttons in the modal header
- Closes on Escape or backdrop click

## Empty states

- **No repo selected:** prompt to pick a folder
- **On feature branch, no changes:** "No changes vs `<default-branch>`"
- **On default branch, no uncommitted changes:** "No uncommitted changes on `<default-branch>`"
- **Loading:** shown while the git command runs
