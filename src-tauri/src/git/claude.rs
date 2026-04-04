use std::process::Stdio;
use tokio::io::AsyncWriteExt;

/// Run a Claude CLI prompt asynchronously, piping stdin_data as input.
pub async fn run_claude_prompt_async(prompt: &str, stdin_data: Vec<u8>) -> Result<String, String> {
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
