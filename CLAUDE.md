# Synopsis — Claude Code Guide

## What this project is

A Tauri v2 desktop app (Rust backend, React + TypeScript frontend) for inspecting git branch changes. Users pick a local repo folder and see five tabs: file-level diff stats, a Claude-generated summary, a detailed hierarchical analysis, an analysis of changed test cases, and before/after Mermaid impact diagrams.

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

### Rust backend (`src-tauri/src/`)
- `git/mod.rs` — re-exports, `run_git()`, `detect_default_branch()`, `pick_folder()`
- `git/types.rs` — all structs (FileStat, DeltaResult, TestCase, SummaryResult, etc.)
- `git/claude.rs` — `run_claude_prompt_async()`
- `git/delta.rs` — `get_delta`, `get_file_diff` + integration tests
- `git/summary.rs` — `get_summary`
- `git/details.rs` — `get_details`, `collect_file_nodes`, `set_node_files`
- `git/tests_cmd.rs` — `get_tests_result`, `collect_changed_tests`, `classify_tests`
- `git/diagrams.rs` — `get_diagrams`
- `prompts.rs` — all Claude prompt strings
- `test_parser.rs` — test file detection and test name extraction
- `symbol_finder.rs` — click-to-definition: find_symbol_definition, read_file_range
- `json_utils.rs` — JSON extraction helpers (extract_json_object, extract_json_array)
- `lib.rs` — plugin registration and command handler wiring

### Frontend (`src/`)
- `App.tsx` — root component, tab routing, RepoProvider
- `contexts/RepoContext.tsx` — app-wide repo path context
- `hooks/useRepo.ts` — all data fetching; keeps App.tsx clean
- `hooks/useHighlighter.ts` — async Shiki syntax highlighting hook
- `lib/highlight.ts` — Shiki singleton, language detection
- `lib/diffStyles.ts` — shared diff line styling utilities
- `types.ts` — all TypeScript types mirroring Rust structs

## Running the app

```bash
make dev          # builds Rust, then launches Tauri dev server
```

## Running tests

```bash
make test         # runs both Rust and frontend tests
make test-rust    # Rust unit + integration tests only
make test-frontend # Vitest only
make check        # type-check both Rust and TypeScript (no tests)
```

## Architecture notes

- **Rust crate is at `src-tauri/`.** Always use `make` targets (`make test-rust`, `make check`, etc.) instead of raw `cargo` commands — the Makefile sources `$HOME/.cargo/env` to ensure cargo is on PATH.
- All git operations run in the Rust backend
- Claude is invoked via the `claude -p` CLI — it must be installed and on PATH
- The folder picker uses Tauri events; everything else uses `invoke`
- Delta is fetched eagerly on folder pick; Summary chains to Details; Tests and Diagrams are lazy
- Two-dot git diff (`git diff <branch>`) is used throughout
- Syntax highlighting uses Shiki (github-dark theme) with async loading
- Click-to-definition uses `git grep --no-index -P` with language-specific definition patterns
- Styling uses Tailwind CSS v4 + shadcn/ui components

## Conventions

- All TypeScript types mirroring Rust structs live in `src/types.ts`
- Behaviour changes must be reflected in the relevant `spec/` file
- **Always use the `/pingpong` skill (TDD ping-pong) to implement any changes to source code**
- **New Tauri commands must have integration tests before merging.** Create a temp git repo in the test, exercise the command, and verify results. See `symbol_finder.rs` tests for the pattern.
- **No React components defined as inner functions.** Always use separate files. Inner function components break React hot-reload when hooks are added or removed.
- **Use `RepoContext` for repo path access.** Don't pass `repoPath` as a prop — use `useRepoPath()` from `src/contexts/RepoContext.tsx`. It returns a non-nullable `string` and throws if no provider is present.
