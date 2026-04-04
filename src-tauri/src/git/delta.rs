use super::types::{DeltaResult, FileStat};
use super::{detect_default_branch, run_git};

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
pub async fn get_file_diff(repo_path: String, file: String) -> Result<String, String> {
    let branch = detect_default_branch(&repo_path);

    let output = std::process::Command::new("git")
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    /// Helper: create a temp dir with a unique name for test isolation.
    fn make_temp_dir(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir()
            .join(format!("synopsis_test_{}_{}", name, std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    /// Helper: run git in a temp repo with author env vars set.
    fn git_cmd(dir: &std::path::Path, args: &[&str]) -> std::process::Output {
        Command::new("git")
            .args(args)
            .current_dir(dir)
            .env("GIT_AUTHOR_NAME", "Test")
            .env("GIT_AUTHOR_EMAIL", "test@test.com")
            .env("GIT_COMMITTER_NAME", "Test")
            .env("GIT_COMMITTER_EMAIL", "test@test.com")
            .output()
            .expect("git command failed")
    }

    fn cleanup(dir: &std::path::Path) {
        let _ = std::fs::remove_dir_all(dir);
    }

    /// Helper: set up a temp git repo with a main branch and an initial commit.
    fn setup_repo(name: &str) -> std::path::PathBuf {
        let dir = make_temp_dir(name);
        git_cmd(&dir, &["init", "-b", "main"]);
        std::fs::write(dir.join("README.md"), "# test\n").unwrap();
        git_cmd(&dir, &["add", "."]);
        git_cmd(&dir, &["-c", "commit.gpgsign=false", "commit", "-m", "init"]);
        dir
    }

    // ── detect_default_branch ───────────────────────────────────────────────

    #[test]
    fn test_detect_default_branch_finds_main() {
        let dir = setup_repo("detect_main");
        let branch = detect_default_branch(dir.to_str().unwrap());
        assert_eq!(branch, "main");
        cleanup(&dir);
    }

    #[test]
    fn test_detect_default_branch_finds_master() {
        let dir = make_temp_dir("detect_master");
        git_cmd(&dir, &["init", "-b", "master"]);
        std::fs::write(dir.join("README.md"), "# test\n").unwrap();
        git_cmd(&dir, &["add", "."]);
        git_cmd(&dir, &["-c", "commit.gpgsign=false", "commit", "-m", "init"]);

        let branch = detect_default_branch(dir.to_str().unwrap());
        assert_eq!(branch, "master");
        cleanup(&dir);
    }

    #[test]
    fn test_detect_default_branch_fallback() {
        // A bare repo with no main/master branches falls back to "main"
        let dir = make_temp_dir("detect_fallback");
        git_cmd(&dir, &["init", "-b", "develop"]);
        std::fs::write(dir.join("README.md"), "# test\n").unwrap();
        git_cmd(&dir, &["add", "."]);
        git_cmd(&dir, &["-c", "commit.gpgsign=false", "commit", "-m", "init"]);

        let branch = detect_default_branch(dir.to_str().unwrap());
        assert_eq!(branch, "main");
        cleanup(&dir);
    }

    // ── get_delta ───────────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_get_delta_shows_changed_files() {
        let dir = setup_repo("delta_changed");

        // Create a feature branch and make changes
        git_cmd(&dir, &["checkout", "-b", "feature"]);
        std::fs::write(dir.join("new_file.txt"), "hello\nworld\n").unwrap();
        git_cmd(&dir, &["add", "."]);
        git_cmd(&dir, &["-c", "commit.gpgsign=false", "commit", "-m", "add file"]);

        let result = get_delta(dir.to_str().unwrap().to_string()).await.unwrap();
        assert_eq!(result.default_branch, "main");
        assert_eq!(result.current_branch, "feature");
        assert_eq!(result.files.len(), 1);
        assert_eq!(result.files[0].path, "new_file.txt");
        assert_eq!(result.files[0].added, 2);
        assert_eq!(result.files[0].removed, 0);
        assert_eq!(result.files[0].status, "added");

        cleanup(&dir);
    }

    #[tokio::test]
    async fn test_get_delta_empty_when_no_changes() {
        let dir = setup_repo("delta_empty");

        let result = get_delta(dir.to_str().unwrap().to_string()).await.unwrap();
        assert_eq!(result.default_branch, "main");
        assert!(result.files.is_empty());

        cleanup(&dir);
    }

    #[tokio::test]
    async fn test_get_delta_includes_untracked_on_default_branch() {
        let dir = setup_repo("delta_untracked");

        // Stay on main and create an untracked file
        std::fs::write(dir.join("untracked.txt"), "line1\nline2\nline3\n").unwrap();

        let result = get_delta(dir.to_str().unwrap().to_string()).await.unwrap();
        assert_eq!(result.current_branch, "main");

        let untracked_file = result.files.iter().find(|f| f.path == "untracked.txt");
        assert!(untracked_file.is_some(), "should include untracked file");
        let f = untracked_file.unwrap();
        assert!(f.untracked);
        assert_eq!(f.added, 3);
        assert_eq!(f.status, "added");

        cleanup(&dir);
    }

    // ── get_file_diff ───────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_get_file_diff_returns_diff() {
        let dir = setup_repo("file_diff");

        git_cmd(&dir, &["checkout", "-b", "feature"]);
        std::fs::write(dir.join("README.md"), "# updated\n").unwrap();
        git_cmd(&dir, &["add", "."]);
        git_cmd(&dir, &["-c", "commit.gpgsign=false", "commit", "-m", "update"]);

        let diff = get_file_diff(
            dir.to_str().unwrap().to_string(),
            "README.md".to_string(),
        )
        .await
        .unwrap();

        assert!(diff.contains("-# test"));
        assert!(diff.contains("+# updated"));

        cleanup(&dir);
    }

    #[tokio::test]
    async fn test_get_file_diff_untracked_shows_as_added() {
        let dir = setup_repo("file_diff_untracked");

        // Create untracked file (stay on main)
        std::fs::write(dir.join("new.txt"), "line1\nline2\n").unwrap();

        let diff = get_file_diff(
            dir.to_str().unwrap().to_string(),
            "new.txt".to_string(),
        )
        .await
        .unwrap();

        assert!(diff.contains("@@ -0,0 +1,2 @@"));
        assert!(diff.contains("+line1"));
        assert!(diff.contains("+line2"));

        cleanup(&dir);
    }
}
