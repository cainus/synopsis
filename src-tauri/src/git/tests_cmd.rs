use super::claude::run_claude_prompt_async;
use super::detect_default_branch;
use super::run_git;
use super::types::{TestCase, TestsResult};
use crate::json_utils::extract_json_array;
use crate::prompts;
use crate::test_parser;

/// Extract test names from a single file, handling both tracked (diff) and untracked (read) files.
/// Returns a list of (test_name, hunk, file_path) tuples.
fn extract_file_tests(
    repo_path: &str,
    file: &str,
    default_branch: &str,
    is_untracked: bool,
) -> Result<Vec<(String, String, String)>, String> {
    let mut results = Vec::new();

    if is_untracked {
        let full_path = std::path::Path::new(repo_path).join(file);
        let content = std::fs::read_to_string(&full_path).unwrap_or_default();
        for (name, _) in test_parser::extract_tests_from_content(&content) {
            results.push((name, String::new(), file.to_string()));
        }
    } else {
        let diff = run_git(repo_path, &["diff", default_branch, "--", file])?;
        for (name, hunk) in test_parser::extract_changed_tests(&diff) {
            results.push((name, hunk, file.to_string()));
        }
    }

    Ok(results)
}

/// Collect all changed test cases from the repo, scanning both tracked and untracked files.
fn collect_changed_tests(
    repo_path: &str,
    default_branch: &str,
) -> Result<(Vec<(String, String, String)>, bool), String> {
    let changed_files =
        run_git(repo_path, &["diff", "--name-only", default_branch]).unwrap_or_default();
    let untracked_files =
        run_git(repo_path, &["ls-files", "--others", "--exclude-standard"]).unwrap_or_default();
    let all_files: Vec<&str> = changed_files
        .lines()
        .chain(untracked_files.lines())
        .filter(|l| !l.is_empty())
        .collect();

    let untracked_set: std::collections::HashSet<&str> = untracked_files
        .lines()
        .filter(|l| !l.is_empty())
        .collect();

    let mut all_tests: Vec<(String, String, String)> = Vec::new();
    let mut any_test_file = false;

    for file in all_files {
        let is_untracked = untracked_set.contains(file);

        if test_parser::is_test_file(file) {
            any_test_file = true;
            let tests = extract_file_tests(repo_path, file, default_branch, is_untracked)?;
            all_tests.extend(tests);
        } else if file.ends_with(".rs") {
            // Rust inline #[test] functions can live in any .rs file, so for .rs files
            // we check whether the content/diff mentions #[test].
            if is_untracked {
                let full_path = std::path::Path::new(repo_path).join(file);
                let content = std::fs::read_to_string(&full_path).unwrap_or_default();
                if content.contains("#[test]") {
                    any_test_file = true;
                    let tests =
                        extract_file_tests(repo_path, file, default_branch, is_untracked)?;
                    all_tests.extend(tests);
                }
            } else {
                let diff =
                    run_git(repo_path, &["diff", default_branch, "--", file])?;
                if diff.contains("#[test]") {
                    any_test_file = true;
                    for (name, hunk) in test_parser::extract_changed_tests(&diff) {
                        all_tests.push((name, hunk, file.to_string()));
                    }
                }
            }
        }
    }

    Ok((all_tests, any_test_file))
}

/// Separate tests into pre-classified (new) and modified (need Claude analysis).
fn classify_tests(
    all_tests: Vec<(String, String, String)>,
) -> (Vec<TestCase>, Vec<(String, String, String)>) {
    let mut pre_classified: Vec<TestCase> = Vec::new();
    let mut modified: Vec<(String, String, String)> = Vec::new();

    for (name, hunk, file) in all_tests {
        let is_new = !hunk.lines().any(|l| l.starts_with('-'));
        if is_new {
            pre_classified.push(TestCase {
                full_name: name,
                file,
                behaviour_change: "New test".to_string(),
                snippet: hunk,
            });
        } else {
            modified.push((name, hunk, file));
        }
    }

    (pre_classified, modified)
}

#[tauri::command]
pub async fn get_tests_result(repo_path: String) -> Result<TestsResult, String> {
    let default_branch = detect_default_branch(&repo_path);

    let (all_tests, any_test_file) = collect_changed_tests(&repo_path, &default_branch)?;

    if !any_test_file || all_tests.is_empty() {
        return Ok(TestsResult {
            test_cases: vec![],
        });
    }

    let (pre_classified, modified) = classify_tests(all_tests);

    // If all tests are new there's nothing for Claude to do.
    if modified.is_empty() {
        return Ok(TestsResult {
            test_cases: pre_classified,
        });
    }

    // Build prompt for Claude (modified tests only)
    let test_pairs: Vec<(String, String)> = modified
        .iter()
        .map(|(name, hunk, _)| (name.clone(), hunk.clone()))
        .collect();
    let prompt = prompts::tests_prompt(&test_pairs);

    let response = run_claude_prompt_async(&prompt, Vec::new()).await?;

    // Parse JSON response from Claude — may be wrapped in ```json ... ```
    let json_str = extract_json_array(&response);

    #[derive(serde::Deserialize)]
    struct ClaudeEntry {
        full_name: String,
        behaviour_change: String,
    }

    let claude_entries: Vec<ClaudeEntry> = serde_json::from_str(&json_str).unwrap_or_default();

    // Map Claude results back to TestCase, preserving file and hunk from modified list
    let meta_by_name: std::collections::HashMap<&str, (&str, &str)> = modified
        .iter()
        .map(|(n, h, f)| (n.as_str(), (f.as_str(), h.as_str())))
        .collect();

    let mut claude_cases: Vec<TestCase> = claude_entries
        .into_iter()
        .map(|e| {
            let (file, snippet) = meta_by_name
                .get(e.full_name.as_str())
                .copied()
                .unwrap_or(("", ""));
            TestCase {
                file: file.to_string(),
                full_name: e.full_name,
                behaviour_change: e.behaviour_change,
                snippet: snippet.to_string(),
            }
        })
        .collect();

    // Fallback: if Claude returned nothing, mark all modified tests as unable to determine
    if claude_cases.is_empty() {
        claude_cases = modified
            .iter()
            .map(|(name, hunk, file)| TestCase {
                full_name: name.clone(),
                file: file.clone(),
                behaviour_change: "Unable to determine".to_string(),
                snippet: hunk.clone(),
            })
            .collect();
    }

    let mut test_cases = pre_classified;
    test_cases.extend(claude_cases);
    Ok(TestsResult { test_cases })
}
