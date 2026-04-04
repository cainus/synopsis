use std::process::Command;

use super::claude::run_claude_prompt_async;
use super::detect_default_branch;
use super::types::SummaryResult;
use crate::json_utils::extract_json_object;
use crate::prompts;

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

    let response =
        run_claude_prompt_async(prompts::SUMMARY_PROMPT, diff_output.stdout).await?;
    let json_str = extract_json_object(&response);

    let parsed: SummaryResult = serde_json::from_str(&json_str).map_err(|e| {
        format!("Failed to parse Claude response: {}\nRaw: {}", e, response)
    })?;

    Ok(parsed)
}
