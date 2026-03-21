# Architecture

Synopsis is a Tauri v2 desktop app with a Rust backend and a React + TypeScript frontend.

## Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri v2 |
| Backend | Rust |
| Frontend | React 18 + TypeScript |
| Build tool | Vite |
| Styling | Plain CSS |

## Directory structure

```
synopsis/
├── src/                        # React frontend
│   ├── App.tsx                 # Root component, tab routing
│   ├── App.css                 # All styles
│   ├── types.ts                # Shared TypeScript types
│   ├── hooks/
│   │   └── useRepo.ts          # Data fetching hook
│   └── components/
│       ├── FolderPicker.tsx    # Folder selection + refresh button
│       ├── TabBar.tsx          # Tab navigation
│       ├── DeltaTab.tsx        # Delta tab view
│       ├── SummaryTab.tsx      # Summary tab view
│       └── TestsTab.tsx        # Tests tab view
├── src-tauri/
│   ├── src/
│   │   ├── main.rs             # Binary entry point
│   │   ├── lib.rs              # Plugin registration, command wiring
│   │   └── git.rs              # All git logic and Tauri commands
│   ├── capabilities/
│   │   └── default.json        # Tauri permission grants
│   └── tauri.conf.json         # App configuration
└── spec/                       # Specifications (this directory)
```

## Tauri commands

All backend logic lives in `src-tauri/src/git.rs`.

| Command | Type | Description |
|---------|------|-------------|
| `pick_folder` | sync | Opens a native folder picker dialog; emits `folder-picked` event with the chosen path |
| `get_delta` | sync | Returns `DeltaResult` — files changed vs default branch with line counts |
| `get_summary` | async | Streams Claude output via `summary-chunk` / `summary-done` events |
| `get_tests_result` | sync | Returns `TestsResult` — parsed test cases with behaviour descriptions |

## Data flow

```
User picks folder
       │
       ▼
get_delta (eager)          ← runs immediately, fast
       │
       ▼
DeltaTab renders

User visits Summary tab
       │
       ▼
get_summary (lazy, streaming)
  git diff | claude -p
  → emits summary-chunk events
       │
       ▼
SummaryTab appends lines

User visits Tests tab
       │
       ▼
get_tests_result (lazy)
  git diff --name-only
  → filter test files
  → git diff per file
  → parse describe/it blocks
  → claude -p (single call, JSON response)
       │
       ▼
TestsTab renders test cases
```

## Default branch detection

The backend tries these in order until one succeeds:

1. `git symbolic-ref refs/remotes/origin/HEAD --short` (strips `origin/` prefix)
2. Check if `main` branch exists locally
3. Check if `master` branch exists locally
4. Fallback: `"main"`

## Event system

The folder picker and summary streaming use Tauri's event system rather than direct return values because they are either callback-based (dialog) or long-running (Claude). All other commands return values directly via `invoke`.

## Frontend state

All data fetching is centralised in `useRepo.ts`. It tracks:

- `repoPath` — the selected folder
- `deltaResult` — loaded eagerly when `repoPath` changes
- `summaryLines` / `summaryDone` — loaded lazily on first Summary tab visit
- `testsResult` — loaded lazily on first Tests tab visit
- `loading` — per-tab loading flags
- `refreshKey` — incrementing counter that re-triggers the delta `useEffect`

Summary and Tests each have a `fetched` ref to prevent duplicate fetches across re-renders.
