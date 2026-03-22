# Summary Tab

The Summary tab asks Claude to describe the changes on the branch in plain English.

## Behaviour

The tab starts empty with a **Generate Summary** button. Clicking it (or switching to the tab for the first time) triggers the analysis. Output streams in line by line as Claude responds — a blinking cursor indicates it is still running.

Once generated, the summary is cached for the session. Clicking **↺** (refresh) clears it so it can be regenerated.

## How it works

1. Run `git diff <default-branch>` to get the full patch (two-dot, includes staged and unstaged changes)
2. If the diff is empty, display "No changes found vs the default branch" immediately
3. Otherwise pipe the diff into `claude -p` with this prompt:

   > Summarize these code changes concisely for a developer. Focus on what changed and why it matters. Be brief.

4. Stream stdout from the Claude process line by line into the UI; output is rendered as Markdown
5. Emit a done signal when the process exits

## Streaming

Output is delivered via Tauri events:

| Event | Payload | Meaning |
|-------|---------|---------|
| `summary-chunk` | string | One line of Claude's response |
| `summary-done` | — | Claude has finished |

The frontend listens for these events and appends each chunk to the display.

## Dependencies

Requires the `claude` CLI to be installed and on `PATH`.
