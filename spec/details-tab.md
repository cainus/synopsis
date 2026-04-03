# Details Tab

The Details tab shows a detailed, hierarchical breakdown of the branch changes, split into **Product Changes** and **Technical Changes** with collapsible sub-items and code snippet links.

## Behaviour

- The Details tab is the **second tab**, immediately after Summary.
- It is **lazy-loaded** — fetched on first visit to the tab.
- A **Generate Details** button appears before data is fetched.
- While Claude is working, a spinner with "Claude is thinking…" is displayed.
- Once generated, the result is **cached for the session**.
- Only one top-level item can be open at a time across both sections; nested items are independently collapsible.

## Display

Two sections, each with up to 4 top-level bullet points:

### Product Changes
User-facing or product-level changes. Hidden entirely if empty.

### Technical Changes
Technical / architectural changes (refactors, new internals, dependency changes, performance, etc.).

## Collapsible hierarchy

Every item at every level is **collapsible** if it has children:

- **Top-level items**: only one open at a time across both sections. Uses chevron rotation + `grid-template-rows` slide animation (150ms ease).
- **Nested items** (level 2+): independently collapsible. Multiple can be open simultaneously.
- **Leaf nodes** (no children): displayed inline as plain text with a `–` prefix.

### Depth structure (enforced by the Claude prompt)

| Level | Purpose | Title length |
|-------|---------|-------------|
| Top-level | Short scannable heading | Under 12 words |
| Level 2 | Descriptive sentences explaining the change | 20–40 words, 2–4 per parent (mandatory) |
| Level 3 | Supporting specifics (files, APIs, edge cases) | Optional, 1–3 per parent |
| Level 4 | Rare, only if needed | No deeper |

## Code snippet links

Each item may include a **files** array containing one or more `{file, snippet}` pairs:

- `file`: file path from the diff.
- `snippet`: relevant diff lines (3–15 lines with `@@` hunk header).
- A single change item can reference **multiple files** when the change spans several files.
- A file may appear multiple times (one entry per relevant hunk).
- Organizational nodes use an empty `files: []` array.

Items with files show a **code icon button** (`</>`) inline after the title. Clicking opens the shared **DiffModal** with **all** file snippets for that item, grouped by file path with `diff --git` headers between sections. No backend call needed.

### Snippet rules (enforced by prompt)

- Attached at the most specific (leaf) level
- Concrete change nodes must have at least one entry in files
- When a change spans multiple files, all relevant files are included
- When a file has multiple relevant hunks, include multiple entries with the same file path
- Lines copied verbatim from the diff

## How it works (backend)

1. `get_details(repo_path)` is called via Tauri `invoke`.
2. Run `git diff <default-branch>` (two-dot diff).
3. If empty → return empty product/technical arrays.
4. Pipe diff into `claude -p` requesting JSON with `product_changes` and `technical_changes`.
5. Parse and return a `DetailsResult`.

This is a **separate Claude call** from the Summary tab, with its own prompt focused on detailed hierarchical analysis.

## Data shape

```rust
pub struct FileSnippet {
    pub file: String,
    pub snippet: String,
}

pub struct SummaryChangeItem {
    pub title: String,
    pub children: Vec<SummaryChangeItem>,  // recursive
    pub files: Vec<FileSnippet>,
}

pub struct DetailsResult {
    pub product_changes: Vec<SummaryChangeItem>,   // max 4
    pub technical_changes: Vec<SummaryChangeItem>,  // max 4
}
```

```ts
interface FileSnippet {
  file: string;
  snippet: string;
}

interface SummaryChangeItem {
  title: string;
  children: SummaryChangeItem[];
  files: FileSnippet[];
}

interface DetailsResult {
  product_changes: SummaryChangeItem[];
  technical_changes: SummaryChangeItem[];
}
```

## Key files

| File | Role |
|------|------|
| `src-tauri/src/git.rs` | `get_details()` — runs git diff, calls Claude, parses JSON |
| `src/components/DetailsTab.tsx` | Collapsible hierarchy, snippet links, diff modal |
| `src/components/DiffModal.tsx` | Shared modal for inline + side-by-side diff views |
| `src/hooks/useRepo.ts` | `fetchDetails()` — called on first Details tab visit |

## Dependencies

Requires the `claude` CLI to be installed and on `PATH`.
