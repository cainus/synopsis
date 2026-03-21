# Delta Tab

The Delta tab shows which files changed on the current branch compared to the default branch, and how many lines were added or removed in each.

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

## Git command

```
git diff --numstat <default-branch>...HEAD
```

The three-dot range (`...`) compares the current branch against the merge base, not the tip of the default branch. This ensures the delta only reflects what this branch introduced, even if the default branch has moved on since the branch was created.

## Empty states

- **No repo selected:** prompt to pick a folder
- **No changes:** message indicating the branch is identical to the default branch
- **Loading:** shown while the git command runs
