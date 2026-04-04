use std::process::Command;

use super::claude::run_claude_prompt_async;
use super::detect_default_branch;
use super::types::DiagramsResult;
use crate::json_utils::extract_json_object;
use crate::prompts;

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

    let response =
        run_claude_prompt_async(prompts::DIAGRAMS_PROMPT, diff_output.stdout).await?;

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
