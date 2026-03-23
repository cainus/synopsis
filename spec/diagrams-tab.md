# Diagrams Tab

The Diagrams tab shows two Mermaid flowcharts — a **Before** and an **After** — visualising the structural impact of the changes on the codebase.

## Behaviour

The tab starts empty with a **Generate Diagrams** button. Clicking it (or switching to the tab for the first time) triggers the analysis. Once generated, the result is cached for the session.

## How it works

1. Run `git diff <default-branch>` to get the full patch (two-dot, same as Summary)
2. If the diff is empty, show placeholder "No changes" graphs immediately
3. Otherwise pipe the diff into `claude -p` with a prompt asking for two Mermaid `graph LR` diagrams:
   - **before**: key components/functions/modules involved in the change and how they related *before* the diff
   - **after**: those same elements and their new relationships *after* the diff, including any new nodes
4. Parse the JSON response `{"before": "...", "after": "..."}` and render both diagrams with the `mermaid` library

## Display

Two panels side by side, each labelled **Before** / **After**, each rendering the Mermaid SVG centred inside a dark card.

## Dependencies

- Requires the `claude` CLI to be installed and on `PATH`
- Uses the `mermaid` npm package for client-side SVG rendering
