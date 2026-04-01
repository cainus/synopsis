# Diagrams Tab

The Diagrams tab shows two Mermaid flowcharts — a **Before** and an **After** — visualising the structural impact of the changes on the codebase.

## Behaviour

The tab starts empty with a **Generate Diagrams** button. Clicking it (or switching to the tab for the first time) triggers the analysis. Once generated, the result is cached for the session.

## How it works

1. Run `git diff <default-branch>` to get the full patch (two-dot, same as Summary)
2. If the diff is empty, show placeholder "No changes" graphs immediately
3. Otherwise pipe the diff into `claude -p` with a prompt asking for two Mermaid `graph LR` diagrams:
   - **before**: key functions/methods involved and how they called each other *before* the diff — every node must be a function or method (no modules, files, classes, or components)
   - **after**: those same functions/methods and their new call relationships *after* the diff, including any new nodes — same node-type constraint applies
4. Parse the JSON response and render both diagrams with the `mermaid` library

## JSON response shape

```json
{
  "before": "graph LR ...",
  "after": "graph LR ...",
  "before_caption": "One sentence describing the before diagram",
  "after_caption": "One sentence describing the after diagram"
}
```

## Node styling

Nodes are colour-coded by change type using Mermaid `classDef`:

**Before diagram:**
- Removed nodes (gone in after): `fill:#3a1a1a,stroke:#f44336,color:#ccc`
- Modified nodes (present in both): `fill:#3a2e00,stroke:#ffb300,color:#ccc`
- Unchanged nodes: default styling

**After diagram:**
- Added nodes (new in after): `fill:#1a3a1a,stroke:#4caf50,color:#ccc`
- Modified nodes (present in both): `fill:#3a2e00,stroke:#ffb300,color:#ccc`
- Unchanged nodes: default styling

### Extract function/method rule

If the diff is an "extract function" or "extract method" refactor, the before diagram uses a Mermaid `subgraph` to show the to-be-extracted logic nested inside its parent function.

## Display

Two panels side by side, each with:
- A label (**Before** / **After**) with a colour legend (removed/modified or added/modified)
- A caption sentence below the label
- The Mermaid SVG rendered centred inside a dark card

## Prompt rules

- Use `graph LR` direction for both
- Every node must be a function or method — no exceptions
- Max ~12 nodes each
- Node labels must look like function calls (e.g. `doThing()` or `Foo.bar()`)
- Node IDs must be alphanumeric (no spaces or special chars)

## Data shape

```ts
interface DiagramsResult {
  before: string;           // Mermaid graph string
  after: string;            // Mermaid graph string
  before_caption: string;   // one sentence
  after_caption: string;    // one sentence
}
```

## Dependencies

- Requires the `claude` CLI to be installed and on `PATH`
- Uses the `mermaid` npm package for client-side SVG rendering
