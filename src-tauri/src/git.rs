use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use tauri::Emitter;

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct FileStat {
    pub path: String,
    pub added: u32,
    pub removed: u32,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct DeltaResult {
    pub default_branch: String,
    pub files: Vec<FileStat>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct TestCase {
    pub full_name: String,
    pub behaviour_change: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct TestsResult {
    pub test_cases: Vec<TestCase>,
}

fn run_git(repo_path: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd_args = vec!["-C", repo_path];
    cmd_args.extend_from_slice(args);
    let output = Command::new("git")
        .args(&cmd_args)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

pub fn detect_default_branch(repo_path: &str) -> String {
    // Try remote HEAD
    if let Ok(out) = run_git(
        repo_path,
        &["symbolic-ref", "refs/remotes/origin/HEAD", "--short"],
    ) {
        let trimmed = out.trim();
        if !trimmed.is_empty() {
            let branch = trimmed.strip_prefix("origin/").unwrap_or(trimmed);
            return branch.to_string();
        }
    }
    // Try local main / master
    for branch in &["main", "master"] {
        if let Ok(out) = run_git(repo_path, &["branch", "--list", branch]) {
            if !out.trim().is_empty() {
                return branch.to_string();
            }
        }
    }
    "main".to_string()
}

#[tauri::command]
pub fn pick_folder(window: tauri::Window) -> Result<(), String> {
    use tauri_plugin_dialog::DialogExt;
    window.dialog().file().pick_folder(move |path| {
        let result = path.map(|p| p.to_string());
        let _ = window.emit("folder-picked", result);
    });
    Ok(())
}

#[tauri::command]
pub fn get_delta(repo_path: String) -> Result<DeltaResult, String> {
    let branch = detect_default_branch(&repo_path);
    let range = format!("{}...HEAD", branch);
    let out = run_git(&repo_path, &["diff", "--numstat", &range])?;

    let mut files = Vec::new();
    for line in out.lines() {
        let parts: Vec<&str> = line.splitn(3, '\t').collect();
        if parts.len() == 3 {
            let added = parts[0].parse::<u32>().unwrap_or(0);
            let removed = parts[1].parse::<u32>().unwrap_or(0);
            let path = parts[2].to_string();
            files.push(FileStat {
                path,
                added,
                removed,
            });
        }
    }

    Ok(DeltaResult {
        default_branch: branch,
        files,
    })
}

#[tauri::command]
pub async fn get_summary(repo_path: String, window: tauri::Window) -> Result<(), String> {
    let branch = detect_default_branch(&repo_path);
    let range = format!("{}...HEAD", branch);

    // Get the diff
    let diff_output = Command::new("git")
        .args(["-C", &repo_path, "diff", &range])
        .output()
        .map_err(|e| format!("Failed to run git diff: {}", e))?;

    if diff_output.stdout.is_empty() {
        let _ = window.emit("summary-chunk", "No changes found vs the default branch.");
        let _ = window.emit("summary-done", ());
        return Ok(());
    }

    // Pipe diff into claude -p
    let mut child = Command::new("claude")
        .args(["-p", "Summarize these code changes concisely for a developer. Focus on what changed and why it matters. Be brief."])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start claude: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(&diff_output.stdout)
            .map_err(|e| format!("Failed to write to claude stdin: {}", e))?;
    }

    let stdout = child.stdout.take().ok_or("No stdout")?;
    let reader = BufReader::new(stdout);
    for line in reader.lines() {
        match line {
            Ok(l) => {
                let _ = window.emit("summary-chunk", l);
            }
            Err(_) => break,
        }
    }

    let _ = child.wait();
    let _ = window.emit("summary-done", ());
    Ok(())
}

fn is_test_file(path: &str) -> bool {
    let p = path.to_lowercase();
    let filename = path.split('/').next_back().unwrap_or("").to_lowercase();

    // Match directory segments anywhere in path (including at root)
    let in_test_dir = |seg: &str| {
        p.starts_with(&format!("{}/", seg))
            || p.contains(&format!("/{}/", seg))
    };

    in_test_dir("test")
        || in_test_dir("tests")
        || in_test_dir("__tests__")
        || in_test_dir("spec")
        || in_test_dir("specs")
        || p.ends_with(".test.ts")
        || p.ends_with(".test.tsx")
        || p.ends_with(".test.js")
        || p.ends_with(".test.jsx")
        || p.ends_with(".spec.ts")
        || p.ends_with(".spec.tsx")
        || p.ends_with(".spec.js")
        || p.ends_with(".spec.jsx")
        || p.ends_with("_test.go")
        || p.ends_with("_test.rs")
        || p.ends_with("_spec.rb")
        || filename.starts_with("test_")
}

/// Extract changed test names from a diff patch.
/// Returns a list of (full_name, hunk_context) tuples.
fn extract_changed_tests(diff: &str) -> Vec<(String, String)> {
    let mut results = Vec::new();
    let mut describe_stack: Vec<(usize, String)> = Vec::new(); // (indent, name)
    let mut current_test: Option<(usize, String)> = None;
    let mut current_hunk: Vec<String> = Vec::new();
    let mut in_changed_hunk = false;
    let mut hunk_has_changes = false;

    for line in diff.lines() {
        // Skip diff header lines
        if line.starts_with("diff --git")
            || line.starts_with("index ")
            || line.starts_with("--- ")
            || line.starts_with("+++ ")
        {
            continue;
        }

        if line.starts_with("@@") {
            // Save previous test if it had changes
            if hunk_has_changes {
                if let Some((_, ref name)) = current_test {
                    results.push((name.clone(), current_hunk.join("\n")));
                }
            }
            current_hunk.clear();
            in_changed_hunk = true;
            hunk_has_changes = false;
            current_test = None;
            continue;
        }

        if !in_changed_hunk {
            continue;
        }

        // Determine the actual content (strip leading +/-/space)
        let content = if line.starts_with('+') || line.starts_with('-') || line.starts_with(' ') {
            &line[1..]
        } else {
            line
        };

        let is_changed = line.starts_with('+') || line.starts_with('-');
        let indent = content.len() - content.trim_start().len();
        let trimmed = content.trim();

        // Pop describe stack when indent decreases
        while let Some(&(d_indent, _)) = describe_stack.last() {
            if indent <= d_indent {
                describe_stack.pop();
            } else {
                break;
            }
        }

        // Detect describe/context blocks
        if let Some(name) = extract_block_name(trimmed, &["describe(", "context(", "suite("]) {
            describe_stack.push((indent, name));
        }

        // Detect it/test blocks
        if let Some(name) = extract_block_name(trimmed, &["it(", "test(", "it.only(", "test.only(", "xit(", "xtest("]) {
            let full_name = if describe_stack.is_empty() {
                name.clone()
            } else {
                let path: Vec<&str> = describe_stack.iter().map(|(_, n)| n.as_str()).collect();
                format!("{} > {}", path.join(" > "), name)
            };
            // Save previous test if it had changes
            if hunk_has_changes {
                if let Some((_, ref prev_name)) = current_test {
                    results.push((prev_name.clone(), current_hunk.join("\n")));
                }
            }
            current_test = Some((indent, full_name));
            current_hunk.clear();
            hunk_has_changes = false;
        }

        if is_changed {
            hunk_has_changes = true;
        }

        if current_test.is_some() {
            current_hunk.push(line.to_string());
        }
    }

    // Final test
    if hunk_has_changes {
        if let Some((_, name)) = current_test {
            results.push((name, current_hunk.join("\n")));
        }
    }

    // Deduplicate by name (keep last occurrence)
    let mut seen = std::collections::HashSet::new();
    let mut deduped: Vec<(String, String)> = Vec::new();
    for item in results.into_iter().rev() {
        if seen.insert(item.0.clone()) {
            deduped.push(item);
        }
    }
    deduped.reverse();
    deduped
}

fn extract_block_name(trimmed: &str, prefixes: &[&str]) -> Option<String> {
    for prefix in prefixes {
        if trimmed.starts_with(prefix) {
            let rest = &trimmed[prefix.len()..];
            // Find the string argument: first quoted string
            if let Some(name) = extract_first_string(rest) {
                return Some(name);
            }
        }
    }
    None
}

fn extract_first_string(s: &str) -> Option<String> {
    let s = s.trim_start();
    let (quote, rest) = if s.starts_with('"') {
        ('"', &s[1..])
    } else if s.starts_with('\'') {
        ('\'', &s[1..])
    } else if s.starts_with('`') {
        ('`', &s[1..])
    } else {
        return None;
    };

    let mut result = String::new();
    let mut escaped = false;
    for ch in rest.chars() {
        if escaped {
            result.push(ch);
            escaped = false;
        } else if ch == '\\' {
            escaped = true;
        } else if ch == quote {
            return Some(result);
        } else {
            result.push(ch);
        }
    }
    None
}

#[tauri::command]
pub fn get_tests_result(repo_path: String) -> Result<TestsResult, String> {
    let branch = detect_default_branch(&repo_path);
    let range = format!("{}...HEAD", branch);

    // Get list of changed files
    let changed_files = run_git(&repo_path, &["diff", "--name-only", &range])?;
    let test_files: Vec<&str> = changed_files
        .lines()
        .filter(|f| is_test_file(f))
        .collect();

    if test_files.is_empty() {
        return Ok(TestsResult {
            test_cases: vec![],
        });
    }

    // Get diff for each test file and extract changed test names
    let mut all_tests: Vec<(String, String)> = Vec::new();
    for file in &test_files {
        let diff = run_git(&repo_path, &["diff", &range, "--", file])?;
        let tests = extract_changed_tests(&diff);
        all_tests.extend(tests);
    }

    if all_tests.is_empty() {
        return Ok(TestsResult {
            test_cases: vec![],
        });
    }

    // Build prompt for Claude
    let mut prompt = String::from(
        "For each test case below, if the diff shows a behaviour change write ONE English sentence describing what changed. Otherwise write exactly \"No behaviour change\". Respond with ONLY a JSON array with objects {\"full_name\": string, \"behaviour_change\": string}. No markdown, no explanation.\n\nTests:\n",
    );
    for (name, hunk) in &all_tests {
        prompt.push_str(&format!("\n---\nTest: {}\nDiff:\n{}\n", name, hunk));
    }

    let child = Command::new("claude")
        .args(["-p", &prompt])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start claude: {}", e))?;

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for claude: {}", e))?;

    let response = String::from_utf8_lossy(&output.stdout).to_string();

    // Parse JSON response from Claude
    // Claude may wrap in ```json ... ``` so strip that
    let json_str = extract_json_array(&response);
    let test_cases: Vec<TestCase> = serde_json::from_str(&json_str).unwrap_or_else(|_| {
        // Fallback: return all tests with unknown status
        all_tests
            .iter()
            .map(|(name, _)| TestCase {
                full_name: name.clone(),
                behaviour_change: "Unable to determine".to_string(),
            })
            .collect()
    });

    Ok(TestsResult { test_cases })
}

fn extract_json_array(s: &str) -> String {
    // Strip markdown code fences if present
    let s = s.trim();
    let s = if let Some(start) = s.find('[') {
        if let Some(end) = s.rfind(']') {
            &s[start..=end]
        } else {
            s
        }
    } else {
        s
    };
    s.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── extract_first_string ──────────────────────────────────────────────────

    #[test]
    fn test_extract_first_string_double_quotes() {
        assert_eq!(
            extract_first_string(r#""hello world", () => {"#),
            Some("hello world".into())
        );
    }

    #[test]
    fn test_extract_first_string_single_quotes() {
        assert_eq!(
            extract_first_string("'single quoted', () => {"),
            Some("single quoted".into())
        );
    }

    #[test]
    fn test_extract_first_string_backticks() {
        assert_eq!(
            extract_first_string("`template string`"),
            Some("template string".into())
        );
    }

    #[test]
    fn test_extract_first_string_escaped_quote() {
        assert_eq!(
            extract_first_string(r#""escaped \"inner\" quote""#),
            Some(r#"escaped "inner" quote"#.into())
        );
    }

    #[test]
    fn test_extract_first_string_no_quote_returns_none() {
        assert_eq!(extract_first_string("noQuoteHere"), None);
    }

    #[test]
    fn test_extract_first_string_unterminated_returns_none() {
        assert_eq!(extract_first_string(r#""unterminated"#), None);
    }

    #[test]
    fn test_extract_first_string_leading_whitespace() {
        assert_eq!(
            extract_first_string(r#"   "leading space""#),
            Some("leading space".into())
        );
    }

    // ── extract_block_name ────────────────────────────────────────────────────

    #[test]
    fn test_extract_block_name_describe() {
        assert_eq!(
            extract_block_name(r#"describe("UserService", () => {"#, &["describe("]),
            Some("UserService".into())
        );
    }

    #[test]
    fn test_extract_block_name_it() {
        assert_eq!(
            extract_block_name(r#"it("returns 404 when not found", () => {"#, &["it("]),
            Some("returns 404 when not found".into())
        );
    }

    #[test]
    fn test_extract_block_name_no_match_returns_none() {
        assert_eq!(
            extract_block_name(r#"const x = 1;"#, &["describe(", "it("]),
            None
        );
    }

    #[test]
    fn test_extract_block_name_picks_correct_prefix() {
        assert_eq!(
            extract_block_name(r#"test("does something")"#, &["describe(", "it(", "test("]),
            Some("does something".into())
        );
    }

    // ── is_test_file ──────────────────────────────────────────────────────────

    #[test]
    fn test_is_test_file_dot_test_ts() {
        assert!(is_test_file("src/utils.test.ts"));
    }

    #[test]
    fn test_is_test_file_dot_spec_tsx() {
        assert!(is_test_file("src/components/Button.spec.tsx"));
    }

    #[test]
    fn test_is_test_file_jest_tests_dir() {
        assert!(is_test_file("src/__tests__/auth.ts"));
    }

    #[test]
    fn test_is_test_file_tests_dir() {
        assert!(is_test_file("tests/integration/login.ts"));
    }

    #[test]
    fn test_is_test_file_go_test() {
        assert!(is_test_file("pkg/parser/parser_test.go"));
    }

    #[test]
    fn test_is_test_file_rust_test() {
        assert!(is_test_file("src/lib_test.rs"));
    }

    #[test]
    fn test_is_test_file_python_prefix() {
        assert!(is_test_file("test_utils.py"));
    }

    #[test]
    fn test_is_test_file_regular_source_file() {
        assert!(!is_test_file("src/utils.ts"));
    }

    #[test]
    fn test_is_test_file_regular_tsx() {
        assert!(!is_test_file("src/components/Button.tsx"));
    }

    #[test]
    fn test_is_test_file_readme() {
        assert!(!is_test_file("README.md"));
    }

    // ── extract_json_array ────────────────────────────────────────────────────

    #[test]
    fn test_extract_json_array_bare() {
        let input = r#"[{"full_name":"foo","behaviour_change":"bar"}]"#;
        assert_eq!(extract_json_array(input), input);
    }

    #[test]
    fn test_extract_json_array_strips_markdown_fence() {
        let input = "```json\n[{\"full_name\":\"foo\",\"behaviour_change\":\"bar\"}]\n```";
        assert_eq!(
            extract_json_array(input),
            r#"[{"full_name":"foo","behaviour_change":"bar"}]"#
        );
    }

    #[test]
    fn test_extract_json_array_leading_text() {
        let input = "Here is the result:\n[{\"a\":\"b\"}]";
        assert_eq!(extract_json_array(input), r#"[{"a":"b"}]"#);
    }

    // ── extract_changed_tests ─────────────────────────────────────────────────

    #[test]
    fn test_extract_changed_tests_simple_it_block() {
        let diff = r#"diff --git a/foo.test.ts b/foo.test.ts
@@ -1,5 +1,5 @@
 describe("MyService", () => {
-  it("returns null on error", () => {
+  it("returns null on error", () => {
-    expect(service.get()).toBeNull();
+    expect(service.get()).toBeNull();
   });
 });"#;
        let tests = extract_changed_tests(diff);
        assert_eq!(tests.len(), 1);
        assert_eq!(tests[0].0, "MyService > returns null on error");
    }

    #[test]
    fn test_extract_changed_tests_nested_describe() {
        let diff = r#"@@ -1,8 +1,8 @@
 describe("Auth", () => {
   describe("login", () => {
     it("rejects bad password", () => {
-      expect(login("x")).toBe(false);
+      expect(login("x")).rejects.toThrow();
     });
   });
 });"#;
        let tests = extract_changed_tests(diff);
        assert_eq!(tests.len(), 1);
        assert_eq!(tests[0].0, "Auth > login > rejects bad password");
    }

    #[test]
    fn test_extract_changed_tests_unchanged_test_not_returned() {
        // No +/- lines inside the it block — should not be returned
        let diff = r#"@@ -1,5 +1,5 @@
 describe("Foo", () => {
   it("does nothing", () => {
     expect(true).toBe(true);
   });
 });"#;
        let tests = extract_changed_tests(diff);
        assert_eq!(tests.len(), 0);
    }

    #[test]
    fn test_extract_changed_tests_multiple_tests_in_file() {
        let diff = r#"@@ -1,10 +1,10 @@
 describe("Parser", () => {
   it("handles empty input", () => {
-    expect(parse("")).toBe(null);
+    expect(parse("")).toStrictEqual({});
   });
   it("handles valid input", () => {
-    expect(parse("ok")).toBe("ok");
+    expect(parse("ok")).toEqual({ value: "ok" });
   });
 });"#;
        let tests = extract_changed_tests(diff);
        assert_eq!(tests.len(), 2);
        assert_eq!(tests[0].0, "Parser > handles empty input");
        assert_eq!(tests[1].0, "Parser > handles valid input");
    }

    #[test]
    fn test_extract_changed_tests_top_level_test_no_describe() {
        let diff = r#"@@ -1,3 +1,3 @@
 test("standalone test", () => {
-  expect(1).toBe(1);
+  expect(1).toBe(2);
 });"#;
        let tests = extract_changed_tests(diff);
        assert_eq!(tests.len(), 1);
        assert_eq!(tests[0].0, "standalone test");
    }

    #[test]
    fn test_extract_changed_tests_single_quoted_names() {
        let diff = r#"@@ -1,3 +1,3 @@
 describe('outer', () => {
   it('inner test', () => {
-    return 1;
+    return 2;
   });
 });"#;
        let tests = extract_changed_tests(diff);
        assert_eq!(tests.len(), 1);
        assert_eq!(tests[0].0, "outer > inner test");
    }
}
