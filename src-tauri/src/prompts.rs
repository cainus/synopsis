pub const SUMMARY_PROMPT: &str = r#"Analyze these code changes and produce a brief structured summary.

Respond with ONLY a JSON object with these fields:
- "headline": a one-sentence summary of all changes in under 15 words
- "bullets": an array of 3-5 key points, each with:
  - "label": a bold category label (1-3 words, e.g. "New feature", "Bug fix", "Refactor", "API change", "Dependencies", "Config", "Tests", "Performance")
  - "text": a single sentence (under 15 words) describing what changed

Rules:
- Each bullet should cover a distinct aspect of the changes
- Labels should be short category tags, not sentences
- Text should be specific and concrete, not vague
- Total word count across all bullets should stay under 80 words
- No markdown in values — plain text only
- No explanation outside the JSON"#;

pub const DETAILS_STRUCTURE_PROMPT: &str = r#"Analyze these code changes and produce a detailed breakdown.

Respond with ONLY a JSON object with these fields:
- "product_changes": array (max 4) of user-facing/product changes. Empty array if none.
- "technical_changes": array (max 4) of technical/architectural changes.

Each item has shape: {"title": "...", "children": [...], "files": [...]}
The tree is recursive — children have the same shape. Leaf nodes use "children": [].
"files" is an array of {"file": "..."} objects — just file paths, NO snippets.
Use "files": [] for organizational nodes that don't reference specific files.
A single change item may reference multiple files when the change spans several files.

CRITICAL depth rules:
- Top-level titles: short scannable label (under 12 words), these are clickable headings
- Level-2 children: descriptive sentences that explain the change in detail (20-40 words each). Every top-level item MUST have 2-4 children at this level.
- Level-3 children: supporting specifics where helpful. Optional, 1-2 per parent.
- No deeper than level 3.

CRITICAL file reference rules:
- Attach files at the most specific level — prefer leaf/detail nodes over top-level groupings
- Every node that describes a concrete code change MUST have at least one file entry
- When a single change spans multiple files, include all relevant files
- Nodes that are purely organizational groupings use "files": []

Example:
{"product_changes": [], "technical_changes": [
  {"title": "Auth now uses JWT instead of sessions", "files": [], "children": [
    {"title": "The express-session middleware was removed and replaced with jwtAuth", "files": [{"file": "src/middleware/auth.ts"}], "children": []},
    {"title": "Session store dependency removed", "files": [{"file": "package.json"}], "children": []}
  ]}
]}

Rules:
- Maximum 4 top-level items per section
- Level-2 children are mandatory and must be descriptive (not terse labels)
- No markdown in values — plain text only
- No explanation outside the JSON"#;

pub fn snippet_prompt(title: &str) -> String {
    format!(
        r#"Given this diff, extract the most relevant code snippets that illustrate this change: "{title}"

Respond with ONLY a JSON object: {{"file_snippets": [{{"file": "...", "snippet": "..."}}]}}

Rules:
- Each snippet should be 10-30 lines of verbatim diff content (including +/- prefixes)
- Include @@ hunk headers for context
- Focus on the most behaviorally meaningful code: logic changes, new functions, API changes, state management
- Do NOT include imports, type declarations, or boilerplate unless they ARE the change
- Return 1-3 snippets total, picking the most important parts
- "file" must be the exact file path from the diff
- Copy lines exactly from the diff — do not edit or summarize"#,
        title = title
    )
}

pub const TESTS_PROMPT_PREFIX: &str = "For each test case below, if the diff shows a behaviour change write ONE English sentence describing what changed. Otherwise write exactly \"No behaviour change\". Respond with ONLY a JSON array with objects {\"full_name\": string, \"behaviour_change\": string}. No markdown, no explanation.\n\nTests:\n";

pub fn tests_prompt(tests: &[(String, String)]) -> String {
    let mut prompt = String::from(TESTS_PROMPT_PREFIX);
    for (name, hunk) in tests {
        prompt.push_str(&format!("\n---\nTest: {}\nDiff:\n{}\n", name, hunk));
    }
    prompt
}

pub const DIAGRAMS_PROMPT: &str = r#"Analyze these code changes and produce two Mermaid flowchart diagrams.

IMPORTANT: Every node must represent a function or method. Do NOT use modules, files, classes, components, or any other non-function/method concepts as nodes. Every node label must be a function or method name (e.g. "myFunction()" or "MyClass.myMethod()").

"before": show the key functions/methods involved and how they called each other BEFORE this diff.
  - Nodes that will be REMOVED (gone in after): class "removed" → fill:#3a1a1a,stroke:#f44336,color:#ccc
  - Nodes that will be MODIFIED (present in both but changed): class "modified" → fill:#3a2e00,stroke:#ffb300,color:#ccc
  - Unchanged nodes: no class
  Include at the top:
    classDef removed fill:#3a1a1a,stroke:#f44336,color:#ccc
    classDef modified fill:#3a2e00,stroke:#ffb300,color:#ccc
  EXTRACT FUNCTION/METHOD RULE: if this diff is an "extract function" or "extract method" refactor,
  use a Mermaid subgraph in the BEFORE diagram to show the to-be-extracted logic nested inside its
  parent function. Example:
    subgraph parentFn["parentFunction()"]
      extractedLogic["logic to extract"]
    end

"after": show those same functions/methods and new call relationships AFTER this diff.
  - Nodes that are NEW (only in after): class "added" → fill:#1a3a1a,stroke:#4caf50,color:#ccc
  - Nodes that were MODIFIED (present in both but changed): class "modified" → fill:#3a2e00,stroke:#ffb300,color:#ccc
  - Unchanged nodes: no class
  Include at the top:
    classDef added fill:#1a3a1a,stroke:#4caf50,color:#ccc
    classDef modified fill:#3a2e00,stroke:#ffb300,color:#ccc

Rules:
- Use `graph LR` direction for both
- Every node is a function or method — no exceptions
- Keep it focused, max ~12 nodes each
- Node labels must look like function calls: e.g. "doThing()" or "Foo.bar()"
- Node IDs must be alphanumeric (no spaces or special chars)
- Respond with ONLY a JSON object: {"before": "...", "after": "...", "before_caption": "...", "after_caption": "..."}
- "before_caption" and "after_caption": one plain-English sentence each describing what the diagram shows
- Values must be valid Mermaid graph strings with no markdown fences
- No explanation outside the JSON"#;
