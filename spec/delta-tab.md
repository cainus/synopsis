# Delta Tab

The Delta tab shows which files changed, and how many lines were added or removed in each. What "changed" means depends on context:

- **On a feature branch:** files changed vs the default branch (`default-branch...HEAD`)
- **On the default branch:** uncommitted changes vs HEAD (`git diff HEAD`)

## Display

Each changed file is shown as a table row:

```
File                       Added   Removed
src/components/App.tsx     +24     -3
src/hooks/useRepo.ts       +11     -0
src/types.ts               +8      -2
─────────────────────────────────────────
Total (3 files)            +43     -5
```

- Added line counts are green
- Removed line counts are red
- A totals row at the bottom sums all files

## Git commands

**Feature branch:**
```
git diff --numstat <default-branch>
```
Three-dot range compares against the merge base, so only what this branch introduced is shown.

A two-dot (working-tree) diff is used so that staged and unstaged local changes are included, and so that changes are visible even when HEAD is the default branch itself (e.g. working directly on main).

## Empty states

- **No repo selected:** prompt to pick a folder
- **On feature branch, no changes:** "No changes vs `<default-branch>`"
- **On default branch, no uncommitted changes:** "No uncommitted changes on `<default-branch>`"
- **Loading:** shown while the git command runs
