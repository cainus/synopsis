# Synopsis — Claude Code Guide

## What this project is

A Tauri v2 desktop app (Rust backend, React + TypeScript frontend) for inspecting git branch changes. Users pick a local repo folder and see four tabs: file-level diff stats, a Claude-generated summary, an analysis of changed test cases, and before/after Mermaid impact diagrams.

## Spec directory

All feature behaviour is documented in `/spec`. **When making any change to behaviour, update the relevant spec file too.**

| File | Covers |
|------|--------|
| `spec/overview.md` | Product overview, core flow, tab summary |
| `spec/delta-tab.md` | Delta tab: file list, git command, empty states |
| `spec/summary-tab.md` | Summary tab: headline + paragraph, Claude prompt |
| `spec/details-tab.md` | Details tab: hierarchical product/technical changes, snippets, Claude prompt |
| `spec/tests-tab.md` | Tests tab: full pipeline, test file heuristics, Claude prompt |
| `spec/diagrams-tab.md` | Diagrams tab: before/after Mermaid impact graphs, Claude prompt |
| `spec/architecture.md` | Stack, directory structure, commands, data flow |

## Key files

- `src-tauri/src/git.rs` — all Rust logic: git commands, test name parsing, Claude calls
- `src-tauri/src/lib.rs` — plugin registration and command handler wiring
- `src/hooks/useRepo.ts` — all data fetching; keeps App.tsx clean
- `src/App.tsx` — root component, tab routing, folder pick handler
- `src-tauri/capabilities/default.json` — Tauri permission grants (shell, dialog, events)

## Running the app

```bash
source "$HOME/.cargo/env"   # if cargo is not on PATH
npm run tauri dev
```

## Running tests

```bash
npm test                          # React component tests (Vitest)
cd src-tauri && cargo test        # Rust unit tests
```

## Architecture notes

- All git operations run in the Rust backend via `src-tauri/src/git.rs`
- Claude is invoked via the `claude -p` CLI — it must be installed and on PATH
- The folder picker and summary streaming use Tauri events; everything else uses `invoke`
- Delta is fetched eagerly on folder pick; Summary, Tests, and Diagrams are lazy (first tab visit)
- Two-dot git diff (`git diff <branch>`) is used throughout — covers committed, staged, and unstaged changes and works when HEAD is the default branch

## Conventions

- No component library — plain CSS in `src/App.css`
- All TypeScript types mirroring Rust structs live in `src/types.ts`
- Behaviour changes must be reflected in the relevant `spec/` file
- **Always use the `/pingpong` skill (TDD ping-pong) to implement any changes to source code**
