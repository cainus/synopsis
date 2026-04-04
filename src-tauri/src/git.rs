use std::io::Write;
use std::process::{Command, Stdio};
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::Semaphore;
use tokio::task::JoinSet;

use crate::json_utils::{extract_json_array, extract_json_object};
use crate::prompts;
use crate::test_parser;

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct FileStat {
    pub path: String,
    pub added: u32,
    pub removed: u32,
    pub untracked: bool,
    pub status: String, // "added", "deleted", "modified"
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct DeltaResult {
    pub default_branch: String,
    pub current_branch: String,
    pub files: Vec<FileStat>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct TestCase {
    pub full_name: String,
    pub file: String,
    pub behaviour_change: String,
    pub snippet: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct TestsResult {
    pub test_cases: Vec<TestCase>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct FileSnippet {
    #[serde(default)]
    pub file: String,
    #[serde(default)]
    pub snippet: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct SummaryChangeItem {
    pub title: String,
    #[serde(default)]
    pub children: Vec<SummaryChangeItem>,
    #[serde(default)]
    pub files: Vec<FileSnippet>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct SummaryBullet {
    pub label: String,
    pub text: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct SummaryResult {
    pub headline: String,
    pub bullets: Vec<SummaryBullet>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct DetailsResult {
    pub product_changes: Vec<SummaryChangeItem>,
    pub technical_changes: Vec<SummaryChangeItem>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct DiagramsResult {
    pub before: String,
    pub after: String,
    pub before_caption: String,
    pub after_caption: String,
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
pub async fn get_delta(repo_path: String) -> Result<DeltaResult, String> {
    let default_branch = detect_default_branch(&repo_path);
    let current_branch = run_git(&repo_path, &["rev-parse", "--abbrev-ref", "HEAD"])
        .map(|s| s.trim().to_string())
        .unwrap_or_default();

    // Two-dot diff covers committed, staged, and unstaged changes — and works
    // correctly when HEAD is the default branch itself (e.g. working on main).
    let out = run_git(&repo_path, &["diff", "--numstat", &default_branch])?;

    // Get file statuses (A=added, D=deleted, M=modified, etc.)
    let status_out = run_git(&repo_path, &["diff", "--name-status", &default_branch])
        .unwrap_or_default();
    let mut status_map = std::collections::HashMap::new();
    for line in status_out.lines() {
        let parts: Vec<&str> = line.splitn(2, '\t').collect();
        if parts.len() == 2 {
            let status = match parts[0].chars().next().unwrap_or('M') {
                'A' => "added",
                'D' => "deleted",
                _ => "modified",
            };
            status_map.insert(parts[1].to_string(), status);
        }
    }

    let mut files = Vec::new();
    for line in out.lines() {
        let parts: Vec<&str> = line.splitn(3, '\t').collect();
        if parts.len() == 3 {
            let added = parts[0].parse::<u32>().unwrap_or(0);
            let removed = parts[1].parse::<u32>().unwrap_or(0);
            let path = parts[2].to_string();
            let status = status_map
                .get(&path)
                .copied()
                .unwrap_or("modified")
                .to_string();
            files.push(FileStat {
                path,
                added,
                removed,
                untracked: false,
                status,
            });
        }
    }

    // When on the default branch, also include untracked files (new files not yet staged).
    if current_branch == default_branch {
        let untracked = run_git(
            &repo_path,
            &["ls-files", "--others", "--exclude-standard"],
        )
        .unwrap_or_default();
        for path in untracked.lines().filter(|l| !l.is_empty()) {
            let full_path = std::path::Path::new(&repo_path).join(path);
            let added = std::fs::read_to_string(&full_path)
                .map(|s| s.lines().count() as u32)
                .unwrap_or(0);
            files.push(FileStat {
                path: path.to_string(),
                added,
                removed: 0,
                untracked: true,
                status: "added".to_string(),
            });
        }
    }

    Ok(DeltaResult {
        default_branch,
        current_branch,
        files,
    })
}

#[tauri::command]
pub async fn get_summary(repo_path: String) -> Result<SummaryResult, String> {
    let branch = detect_default_branch(&repo_path);

    let diff_output = Command::new("git")
        .args(["-C", &repo_path, "diff", &branch])
        .output()
        .map_err(|e| format!("Failed to run git diff: {}", e))?;

    if diff_output.stdout.is_empty() {
        return Ok(SummaryResult {
            headline: "No changes found vs the default branch.".into(),
            bullets: vec![],
        });
    }

    let mut child = Command::new("claude")
        .args(["-p", prompts::SUMMARY_PROMPT])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start claude: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(&diff_output.stdout);
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for claude: {}", e))?;

    let response = String::from_utf8_lossy(&output.stdout).to_string();
    let json_str = extract_json_object(&response);

    let parsed: SummaryResult = serde_json::from_str(&json_str).map_err(|e| {
        format!("Failed to parse Claude response: {}\nRaw: {}", e, response)
    })?;

    Ok(parsed)
}

#[tauri::command]
pub async fn get_details(repo_path: String) -> Result<DetailsResult, String> {
    let branch = detect_default_branch(&repo_path);

    let diff_output = Command::new("git")
        .args(["-C", &repo_path, "diff", &branch])
        .output()
        .map_err(|e| format!("Failed to run git diff: {}", e))?;

    if diff_output.stdout.is_empty() {
        return Ok(DetailsResult {
            product_changes: vec![],
            technical_changes: vec![],
        });
    }

    // --- Phase 1: Get the tree structure (titles + file paths, no snippets) ---

    let response = run_claude_prompt_async(prompts::DETAILS_STRUCTURE_PROMPT, diff_output.stdout.clone()).await?;
    let json_str = extract_json_object(&response);

    let mut parsed: DetailsResult = serde_json::from_str(&json_str).map_err(|e| {
        format!("Failed to parse Claude response: {}\nRaw: {}", e, response)
    })?;

    // --- Phase 2: Fetch snippets in parallel for each node with files ---

    let mut file_nodes = Vec::new();
    collect_file_nodes(&parsed.product_changes, &mut file_nodes, "product", &[]);
    collect_file_nodes(&parsed.technical_changes, &mut file_nodes, "technical", &[]);

    if !file_nodes.is_empty() {
        let semaphore = Arc::new(Semaphore::new(5));
        let mut join_set = JoinSet::new();

        for node in file_nodes {
            let sem = semaphore.clone();
            let repo = repo_path.clone();
            let branch_name = branch.clone();
            let title = node.title.clone();
            let files = node.file_paths.clone();
            let path = node.tree_path.clone();
            let section = node.section.to_string();

            join_set.spawn(async move {
                let _permit = sem.acquire().await.unwrap();

                // Get per-file diffs
                let mut combined_diff = Vec::new();
                for file in &files {
                    let output = tokio::process::Command::new("git")
                        .args(["-C", &repo, "diff", &branch_name, "--", file])
                        .output()
                        .await;
                    if let Ok(o) = output {
                        if !o.stdout.is_empty() {
                            combined_diff.extend_from_slice(&o.stdout);
                            combined_diff.push(b'\n');
                        }
                    }
                }

                if combined_diff.is_empty() {
                    return (section, path, Vec::new());
                }

                let snippet_prompt = prompts::snippet_prompt(&title);

                let result = run_claude_prompt_async(&snippet_prompt, combined_diff).await;
                let snippets = match result {
                    Ok(resp) => {
                        let json = extract_json_object(&resp);
                        #[derive(serde::Deserialize)]
                        struct SnippetResponse {
                            #[serde(default)]
                            file_snippets: Vec<FileSnippet>,
                        }
                        serde_json::from_str::<SnippetResponse>(&json)
                            .map(|r| r.file_snippets)
                            .unwrap_or_default()
                    }
                    Err(_) => Vec::new(),
                };

                (section, path, snippets)
            });
        }

        // Collect results and stitch back into the tree
        while let Some(result) = join_set.join_next().await {
            if let Ok((section, path, snippets)) = result {
                if snippets.is_empty() {
                    continue;
                }
                let tree = if section == "product" {
                    &mut parsed.product_changes
                } else {
                    &mut parsed.technical_changes
                };
                set_node_files(tree, &path, snippets);
            }
        }
    }

    Ok(parsed)
}

/// Run a Claude CLI prompt asynchronously, piping stdin_data as input.
async fn run_claude_prompt_async(prompt: &str, stdin_data: Vec<u8>) -> Result<String, String> {
    use tokio::io::AsyncWriteExt;

    let mut child = tokio::process::Command::new("claude")
        .args(["-p", prompt])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start claude: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(&stdin_data).await;
    }

    let output = child
        .wait_with_output()
        .await
        .map_err(|e| format!("Failed to wait for claude: {}", e))?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Info about a node in the tree that has file references needing snippets.
struct FileNode {
    section: &'static str,    // "product" or "technical"
    tree_path: Vec<usize>,    // index path into the tree
    title: String,
    file_paths: Vec<String>,
}

/// Walk the tree and collect all nodes that have non-empty files.
fn collect_file_nodes(
    items: &[SummaryChangeItem],
    out: &mut Vec<FileNode>,
    section: &'static str,
    parent_path: &[usize],
) {
    for (i, item) in items.iter().enumerate() {
        let mut path = parent_path.to_vec();
        path.push(i);

        let file_paths: Vec<String> = item.files.iter()
            .filter(|f| !f.file.is_empty())
            .map(|f| f.file.clone())
            .collect();

        if !file_paths.is_empty() {
            out.push(FileNode {
                section,
                tree_path: path.clone(),
                title: item.title.clone(),
                file_paths,
            });
        }

        collect_file_nodes(&item.children, out, section, &path);
    }
}

/// Navigate the tree by index path and replace the node's files.
fn set_node_files(tree: &mut Vec<SummaryChangeItem>, path: &[usize], files: Vec<FileSnippet>) {
    if path.is_empty() {
        return;
    }
    if path.len() == 1 {
        if let Some(node) = tree.get_mut(path[0]) {
            node.files = files;
        }
    } else if let Some(node) = tree.get_mut(path[0]) {
        set_node_files(&mut node.children, &path[1..], files);
    }
}

#[tauri::command]
pub async fn get_file_diff(repo_path: String, file: String) -> Result<String, String> {
    let branch = detect_default_branch(&repo_path);

    let output = Command::new("git")
        .args(["-C", &repo_path, "diff", &branch, "--", &file])
        .output()
        .map_err(|e| format!("Failed to run git diff: {}", e))?;

    let diff = String::from_utf8_lossy(&output.stdout).to_string();

    // If git diff returns nothing, the file may be untracked — show its full contents as added
    if diff.trim().is_empty() {
        let file_path = std::path::Path::new(&repo_path).join(&file);
        if file_path.exists() {
            let content = std::fs::read_to_string(&file_path)
                .map_err(|e| format!("Failed to read file: {}", e))?;
            let lines: Vec<String> = content.lines().map(|l| format!("+{}", l)).collect();
            let header = format!("@@ -0,0 +1,{} @@", lines.len());
            return Ok(format!("{}\n{}", header, lines.join("\n")));
        }
    }

    Ok(diff)
}

#[tauri::command]
pub async fn get_tests_result(repo_path: String) -> Result<TestsResult, String> {
    let default_branch = detect_default_branch(&repo_path);

    // Two-dot diff — same approach as get_delta
    let changed_files = run_git(&repo_path, &["diff", "--name-only", &default_branch]).unwrap_or_default();
    let untracked_files = run_git(&repo_path, &["ls-files", "--others", "--exclude-standard"]).unwrap_or_default();
    let all_files: Vec<&str> = changed_files.lines()
        .chain(untracked_files.lines())
        .filter(|l| !l.is_empty())
        .collect();

    // Get diff for each test file and extract changed test names.
    // Use `git diff <branch> -- <file>` so staged changes are included.
    // Rust inline #[test] functions can live in any .rs file, so for .rs files
    // we fetch the diff first and check whether it mentions #[test].
    // all_tests entries: (test_name, hunk, file_path)
    let mut all_tests: Vec<(String, String, String)> = Vec::new();
    let mut any_test_file = false;
    let untracked_set: std::collections::HashSet<&str> = untracked_files.lines()
        .filter(|l| !l.is_empty())
        .collect();

    for file in all_files {
        let is_untracked = untracked_set.contains(file);

        if test_parser::is_test_file(file) {
            any_test_file = true;
            if is_untracked {
                // Untracked file: read it directly, all tests in it are new
                let full_path = std::path::Path::new(&repo_path).join(file);
                let content = std::fs::read_to_string(&full_path).unwrap_or_default();
                for (name, _) in test_parser::extract_tests_from_content(&content) {
                    all_tests.push((name, String::new(), file.to_string()));
                }
            } else {
                let diff = run_git(&repo_path, &["diff", &default_branch, "--", file])?;
                for (name, hunk) in test_parser::extract_changed_tests(&diff) {
                    all_tests.push((name, hunk, file.to_string()));
                }
            }
        } else if file.ends_with(".rs") {
            if is_untracked {
                let full_path = std::path::Path::new(&repo_path).join(file);
                let content = std::fs::read_to_string(&full_path).unwrap_or_default();
                if content.contains("#[test]") {
                    any_test_file = true;
                    for (name, _) in test_parser::extract_tests_from_content(&content) {
                        all_tests.push((name, String::new(), file.to_string()));
                    }
                }
            } else {
                let diff = run_git(&repo_path, &["diff", &default_branch, "--", file])?;
                if diff.contains("#[test]") {
                    any_test_file = true;
                    for (name, hunk) in test_parser::extract_changed_tests(&diff) {
                        all_tests.push((name, hunk, file.to_string()));
                    }
                }
            }
        }
    }

    if !any_test_file {
        return Ok(TestsResult {
            test_cases: vec![],
        });
    }

    if all_tests.is_empty() {
        return Ok(TestsResult {
            test_cases: vec![],
        });
    }

    // A test whose hunk has no removed lines is entirely new — no need to ask Claude.
    let mut pre_classified: Vec<TestCase> = Vec::new();
    let mut modified: Vec<(String, String, String)> = Vec::new(); // name, hunk, file

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

    // If all tests are new there's nothing for Claude to do.
    if modified.is_empty() {
        return Ok(TestsResult { test_cases: pre_classified });
    }

    // Build prompt for Claude (modified tests only)
    let test_pairs: Vec<(String, String)> = modified.iter()
        .map(|(name, hunk, _)| (name.clone(), hunk.clone()))
        .collect();
    let prompt = prompts::tests_prompt(&test_pairs);

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

    // Parse JSON response from Claude — may be wrapped in ```json ... ```
    let json_str = extract_json_array(&response);

    #[derive(serde::Deserialize)]
    struct ClaudeEntry { full_name: String, behaviour_change: String }

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

#[tauri::command]
pub async fn get_diagrams(repo_path: String) -> Result<DiagramsResult, String> {
    let branch = detect_default_branch(&repo_path);

    let diff_output = Command::new("git")
        .args(["-C", &repo_path, "diff", &branch])
        .output()
        .map_err(|e| format!("Failed to run git diff: {}", e))?;

    if diff_output.stdout.is_empty() {
        let empty = "graph LR\n    A[No changes]".to_string();
        return Ok(DiagramsResult {
            before: empty.clone(),
            after: empty,
            before_caption: String::new(),
            after_caption: String::new(),
        });
    }

    let mut child = Command::new("claude")
        .args(["-p", prompts::DIAGRAMS_PROMPT])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start claude: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(&diff_output.stdout);
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for claude: {}", e))?;

    let response = String::from_utf8_lossy(&output.stdout).to_string();

    // Extract JSON object from response
    let json_str = extract_json_object(&response);

    #[derive(serde::Deserialize)]
    struct ClaudeResponse {
        before: String,
        after: String,
        before_caption: String,
        after_caption: String,
    }

    let parsed: ClaudeResponse = serde_json::from_str(&json_str).map_err(|e| {
        format!("Failed to parse Claude response: {}\nRaw: {}", e, response)
    })?;

    Ok(DiagramsResult {
        before: parsed.before,
        after: parsed.after,
        before_caption: parsed.before_caption,
        after_caption: parsed.after_caption,
    })
}
