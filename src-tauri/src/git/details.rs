use std::process::Command;
use std::sync::Arc;
use tokio::sync::Semaphore;
use tokio::task::JoinSet;

use super::claude::run_claude_prompt_async;
use super::detect_default_branch;
use super::types::{DetailsResult, FileSnippet, SummaryChangeItem};
use crate::json_utils::extract_json_object;
use crate::prompts;

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

    let response =
        run_claude_prompt_async(prompts::DETAILS_STRUCTURE_PROMPT, diff_output.stdout.clone())
            .await?;
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

/// Info about a node in the tree that has file references needing snippets.
struct FileNode {
    section: &'static str, // "product" or "technical"
    tree_path: Vec<usize>, // index path into the tree
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

        let file_paths: Vec<String> = item
            .files
            .iter()
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
