# Architecture

Synopsis is a Tauri v2 desktop app with a Rust backend and a React + TypeScript frontend.

## Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri v2 |
| Backend | Rust |
| Frontend | React 18 + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS v4 + shadcn/ui |

## Directory structure

```
synopsis/
├── src/                        # React frontend
│   ├── App.tsx                 # Root component, tab routing (uses shadcn Tabs)
│   ├── index.css               # Tailwind + shadcn theme (dark mode variables)
│   ├── types.ts                # Shared TypeScript types
│   ├── lib/
│   │   └── utils.ts            # cn() utility for Tailwind class merging
│   ├── hooks/
│   │   └── useRepo.ts          # Data fetching hook
│   └── components/
│       ├── ui/                 # shadcn/ui primitives (button, tabs, table, badge, dialog, dropdown-menu, collapsible)
│       ├── FolderPicker.tsx     # Folder selection + refresh button
│       ├── DeltaTab.tsx         # Delta tab view
│       ├── SummaryTab.tsx       # Summary tab view (headline + paragraph)
│       ├── DetailsTab.tsx      # Details tab view (hierarchical changes)
│       ├── TestsTab.tsx         # Tests tab view
│       ├── DiagramsTab.tsx      # Diagrams tab view
│       └── DiffModal.tsx        # Shared diff modal (inline + side-by-side)
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
| `get_delta` | sync | Returns `DeltaResult` — files changed vs default branch with line counts and status |
| `get_summary` | async | Pipes diff into `claude -p`; returns `SummaryResult` with headline + summary |
| `get_details` | async | Pipes diff into `claude -p`; returns `DetailsResult` with hierarchical product/technical changes |
| `get_file_diff` | async | Returns raw diff text for a single file (`git diff <branch> -- <file>`) |
| `get_tests_result` | async | Returns `TestsResult` — parsed test cases with behaviour descriptions and snippets |
| `get_diagrams` | async | Pipes diff into `claude -p`; returns `DiagramsResult` with before/after Mermaid graphs |

## Data flow

```
User picks folder
       │
       ├──► get_delta (eager)     ← runs immediately
       │         │
       │         ▼
       │    DeltaTab renders
       │
       └──► get_summary (eager)   ← runs immediately (default tab)
                 │
                 ▼
            SummaryTab renders headline + paragraph

User visits Details tab
       │
       ▼
get_details (lazy)
  git diff | claude -p (separate call from summary)
  → returns hierarchical product/technical changes
       │
       ▼
DetailsTab renders collapsible hierarchy

User clicks file in DeltaTab
       │
       ▼
get_file_diff (on demand)
       │
       ▼
DiffModal shows file diff

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

User visits Diagrams tab
       │
       ▼
get_diagrams (lazy)
  git diff | claude -p
  → returns before/after Mermaid strings + captions
       │
       ▼
DiagramsTab renders Mermaid SVGs
```

## Default branch detection

The backend tries these in order until one succeeds:

1. `git symbolic-ref refs/remotes/origin/HEAD --short` (strips `origin/` prefix)
2. Check if `main` branch exists locally
3. Check if `master` branch exists locally
4. Fallback: `"main"`

## Event system

The folder picker uses Tauri's event system (`folder-picked` event) because it is callback-based (native dialog). All other commands return values directly via `invoke`.

## Frontend state

All data fetching is centralised in `useRepo.ts`. It tracks:

- `repoPath` — the selected folder
- `deltaResult` — loaded eagerly when `repoPath` changes
- `summaryResult` — loaded eagerly when `repoPath` changes (default tab)
- `detailsResult` — loaded lazily on first Details tab visit
- `testsResult` — loaded lazily on first Tests tab visit
- `diagramsResult` — loaded lazily on first Diagrams tab visit
- `loading` — per-tab loading flags (`delta`, `summary`, `tests`, `diagrams`)
- `refreshKey` — incrementing counter that re-triggers the eager fetches

Summary, Details, Tests, and Diagrams each have a `fetched` ref to prevent duplicate fetches across re-renders.

## Shared DiffModal

The `DiffModal` component is used by three tabs:

- **DeltaTab**: shows full file diff (fetched via `get_file_diff`)
- **DetailsTab**: shows inline snippet (embedded in the data, no backend call)
- **TestsTab**: shows test diff hunk (embedded in the data, no backend call)

The modal supports inline and side-by-side views with a toggle, closes on Escape or backdrop click, and uses a slide-up animation.
