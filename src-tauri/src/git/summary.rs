use std::process::Command;

use super::claude::run_claude_prompt_async;
use super::detect_default_branch;
use super::types::SummaryResult;
use crate::json_utils::extract_json_object;
use crate::prompts;
use crate::test_parser::is_test_file;

fn is_application_code_file(path: &str) -> bool {
    if is_test_file(path) {
        return false;
    }

    let lower = path.to_lowercase();
    let filename = lower.split('/').next_back().unwrap_or("");
    let extension = lower.rsplit_once('.').map(|(_, ext)| ext).unwrap_or("");
    const APP_EXTENSIONS: &[&str] = &[
        "c", "cc", "cpp", "cs", "css", "dart", "ex", "exs", "go", "h", "hpp", "html", "java", "js",
        "jsx", "kt", "kts", "m", "mm", "php", "py", "rb", "rs", "scala", "scss", "sh", "svelte",
        "swift", "ts", "tsx", "vue",
    ];

    APP_EXTENSIONS.contains(&extension)
        && !matches!(
            filename,
            "package-lock.json"
                | "pnpm-lock.yaml"
                | "yarn.lock"
                | "cargo.lock"
                | "gemfile.lock"
                | "poetry.lock"
                | "components.json"
                | "tsconfig.json"
                | "vite.config.ts"
                | "next.config.js"
                | "next.config.ts"
                | "tailwind.config.js"
                | "tailwind.config.ts"
        )
}

fn changed_paths(repo_path: &str, branch: &str) -> Result<Vec<String>, String> {
    let output = Command::new("git")
        .args([
            "-C",
            repo_path,
            "diff",
            "--name-only",
            "--no-renames",
            branch,
        ])
        .output()
        .map_err(|e| format!("Failed to run git diff --name-only: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| line.to_string())
        .collect())
}

#[tauri::command]
pub async fn get_summary(repo_path: String) -> Result<SummaryResult, String> {
    let branch = detect_default_branch(&repo_path);
    let paths = changed_paths(&repo_path, &branch)?;
    let has_test_changes = paths.iter().any(|path| is_test_file(path));
    let has_application_code_changes = paths.iter().any(|path| is_application_code_file(path));

    let diff_output = Command::new("git")
        .args(["-C", &repo_path, "diff", &branch])
        .output()
        .map_err(|e| format!("Failed to run git diff: {}", e))?;

    if diff_output.stdout.is_empty() {
        return Ok(SummaryResult {
            headline: "No changes found vs the default branch.".into(),
            bullets: vec![],
            has_application_code_changes: false,
            has_test_changes: false,
            is_pure_refactor: false,
        });
    }

    let response = run_claude_prompt_async(prompts::SUMMARY_PROMPT, diff_output.stdout).await?;
    let json_str = extract_json_object(&response);

    let mut parsed: SummaryResult = serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse Claude response: {}\nRaw: {}", e, response))?;
    parsed.has_application_code_changes = has_application_code_changes;
    parsed.has_test_changes = has_test_changes;

    Ok(parsed)
}

#[cfg(test)]
mod tests {
    use super::is_application_code_file;

    #[test]
    fn test_application_code_classifier_excludes_tests() {
        assert!(!is_application_code_file("src/app.test.ts"));
        assert!(!is_application_code_file("tests/integration/login.ts"));
    }

    #[test]
    fn test_application_code_classifier_includes_source_files() {
        assert!(is_application_code_file("src/App.tsx"));
        assert!(is_application_code_file("src-tauri/src/lib.rs"));
    }

    #[test]
    fn test_application_code_classifier_excludes_docs_and_lockfiles() {
        assert!(!is_application_code_file("README.md"));
        assert!(!is_application_code_file("package-lock.json"));
        assert!(!is_application_code_file("tsconfig.json"));
    }
}
