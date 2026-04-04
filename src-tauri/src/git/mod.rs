pub(crate) mod claude;
pub(crate) mod delta;
pub(crate) mod details;
pub(crate) mod diagrams;
pub(crate) mod summary;
pub(crate) mod tests_cmd;
pub mod types;

use std::process::Command;
use tauri::Emitter;

// Type re-exports so callers can use git::FileStat etc. without reaching into git::types.
#[allow(unused_imports)]
pub use types::*;

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
