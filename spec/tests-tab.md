# Tests Tab

The Tests tab shows every test case that changed on the branch, along with a plain-English description of whether the behaviour changed or not.

## Display

Test cases are grouped by file. Each file has a collapsible header — only one file can be open at a time. File headers are coloured by status:

- **Green** — all tests in the file are new
- **Yellow** — file has a mix of changes (modified, unchanged, new)
- **Red** — all tests in the file are deleted

Each test case shows an icon before the test name indicating its change type:

| Icon | Colour | Meaning |
|------|--------|---------|
| `+` | Green (#4caf50) | New test |
| `Δ` | Yellow (#ffb300) | Modified (behaviour changed) |
| `−` | Red (#e06c75) | Deleted test |
| (none) | Neutral | No behaviour change |

- New tests show only the `+` icon and test name (no "New test" label)
- Modified tests show the `Δ` icon, test name, and a sentence describing what changed
- Unchanged tests show just the test name and "No behaviour change" in muted grey
- The test name is shown in monospace in `describe > describe > it` format (tree-split by `>`)

### Clicking a test case

Test cases with a diff snippet are clickable. Clicking opens the shared `DiffModal` showing the relevant diff hunk for that test. The modal title shows `file — test name`.

## Pipeline

### 1. Find changed test files

```
git diff --name-only <default-branch>
```

A two-dot (working-tree) diff is used so that staged, unstaged, and committed changes are all included, and so that changes are visible even when HEAD is the default branch. Filter the result to files matching the test file heuristics (see below).

### 2. Get the diff for each test file

```
git diff <default-branch> -- <file>
```

Using a two-dot (worktree) diff rather than `...HEAD` ensures staged changes are included in the diff content.

### 3. Parse changed test names

Scan each diff for test block or function names. Build the full nested path by tracking open describe/context blocks by indent level. A test is considered "changed" if any line inside its body appears in a `+` or `-` hunk line.

**JS/TS block-style** (string argument extracted):
- Block prefixes: `describe(`, `context(`, `suite(`
- Test prefixes: `it(`, `test(`, `it.only(`, `test.only(`, `xit(`, `xtest(`
- String arguments can use double quotes, single quotes, or backticks. Escape sequences (`\"`) are handled.

**Function-style** (function name used directly):
- Go: `func Test...` and `func Benchmark...`
- Python: `def test_...`
- Rust: `fn test_...`, `fn should_...`, or any `fn` immediately preceded by a `#[test]` attribute line

For Rust, any `.rs` file whose diff contains `#[test]` is treated as a test file — even if the file is not named `_test.rs` (inline module tests are common in Rust).

### 3b. Auto-classify new tests

Before calling Claude, any test whose diff hunk contains no removed lines (`-`) is entirely new. These are immediately labelled **"New test"** and excluded from the Claude prompt.

### 4. Ask Claude to classify each change

All changed test names and their diff hunks are sent to `claude -p` in a single call:

> For each test case below, if the diff shows a behaviour change write ONE English sentence describing what changed. Otherwise write exactly "No behaviour change". Respond with ONLY a JSON array with objects `{"full_name": string, "behaviour_change": string}`. No markdown, no explanation.

### 5. Parse the response

Claude returns a JSON array. The response may be wrapped in a markdown code fence — the app strips this before parsing. If parsing fails, all tests are returned with "Unable to determine".

## Data shape

```ts
interface TestCase {
  full_name: string;        // full describe > it path
  file: string;             // file path
  behaviour_change: string; // "New test", "No behaviour change", or description
  snippet: string;          // diff hunk for this test
}

interface TestsResult {
  test_cases: TestCase[];
}
```

## Test file heuristics

A file is considered a test file if any of the following match:

**Path contains a test directory segment** (at root or nested):
- `test/`, `tests/`, `__tests__/`, `spec/`, `specs/`

**File extension pattern:**
- `.test.ts`, `.test.tsx`, `.test.js`, `.test.jsx`
- `.spec.ts`, `.spec.tsx`, `.spec.js`, `.spec.jsx`
- `_test.go`, `_test.rs`, `_test.py`, `_spec.rb`

**Filename prefix:**
- `test_` (e.g. `test_utils.py`)

## Empty states

- **No repo selected:** prompt to pick a folder
- **Loading:** Spinner with "Claude is thinking…" while the pipeline runs
- **No test changes:** message indicating no test files changed
