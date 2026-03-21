# Synopsis — Claude Code Guide

## What this project is

A Tauri v2 desktop app (Rust backend, React + TypeScript frontend) for inspecting git branch changes. Users pick a local repo folder and see three tabs: file-level diff stats, a Claude-generated summary, and an analysis of changed test cases.

## Spec directory

All feature behaviour is documented in `/spec`. **When making any change to behaviour, update the relevant spec file too.**

| File | Covers |
|------|--------|
| `spec/overview.md` | Product overview, core flow, tab summary |
| `spec/delta-tab.md` | Delta tab: file list, git command, empty states |
| `spec/summary-tab.md` | Summary tab: streaming, Claude prompt, events |
| `spec/tests-tab.md` | Tests tab: full pipeline, test file heuristics, Claude prompt |
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
- Delta is fetched eagerly on folder pick; Summary and Tests are lazy (first tab visit)
- Three-dot git ranges (`branch...HEAD`) are used throughout so the diff reflects only what this branch introduced, regardless of whether the default branch has moved

## Conventions

- No component library — plain CSS in `src/App.css`
- All TypeScript types mirroring Rust structs live in `src/types.ts`
- Behaviour changes must be reflected in the relevant `spec/` file
