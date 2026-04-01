# Summary Tab

The Summary tab is the **first and default tab** in Synopsis. It shows a brief, structured overview of the branch changes — a headline plus categorised bullet points.

## Behaviour

- Picking a repo folder **eagerly triggers** the summary (alongside the delta fetch).
- If the user visits the tab before a repo is picked, it shows "Pick a repo folder to generate a summary."
- If data hasn't been fetched yet, a **Generate Summary** button appears.
- While Claude is working, a spinner with "Claude is thinking…" is displayed.
- Once generated, the result is **cached for the session**.

## Display

### Headline
A bold sentence under 15 words summarising all changes.

### Bullet points
3–5 key points, each with:
- A **label** — a short uppercase category tag (1–3 words) in blue, e.g. "New feature", "Bug fix", "Refactor", "API change", "Dependencies"
- A **text** — a single concrete sentence (under 15 words) describing what changed

Bullets are displayed as a clean list with the label left-aligned and the description beside it, separated by subtle dividers. Total word count across all bullets stays under 80 words.

For detailed hierarchical breakdowns with code snippets, see the **Details tab**.

## How it works (backend)

1. `get_summary(repo_path)` is called via Tauri `invoke`.
2. Run `git diff <default-branch>` (two-dot diff).
3. If the diff is empty → return headline "No changes found vs the default branch." with empty bullets.
4. Pipe diff into `claude -p` requesting JSON with `headline` and `bullets`.
5. Parse and return a `SummaryResult`.

## Data shape

```rust
pub struct SummaryBullet {
    pub label: String,  // 1-3 word category tag
    pub text: String,   // single sentence, under 15 words
}

pub struct SummaryResult {
    pub headline: String,          // under 15 words
    pub bullets: Vec<SummaryBullet>, // 3-5 items
}
```

```ts
interface SummaryBullet {
  label: string;
  text: string;
}

interface SummaryResult {
  headline: string;
  bullets: SummaryBullet[];
}
```

## Key files

| File | Role |
|------|------|
| `src-tauri/src/git.rs` | `get_summary()` — runs git diff, calls Claude, parses JSON |
| `src/components/SummaryTab.tsx` | Renders headline and bullet list |
| `src/hooks/useRepo.ts` | `fetchSummary()` — eagerly called on repo pick |

## Dependencies

Requires the `claude` CLI to be installed and on `PATH`.
