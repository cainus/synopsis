use std::process::Command;
use crate::test_parser::is_test_file;

#[derive(serde::Serialize, Clone)]
pub struct DefinitionResult {
    pub file: String,
    pub line_number: u32,
    pub line_content: String,
    pub context_before: Vec<String>,
    pub context_after: Vec<String>,
}

#[tauri::command]
pub async fn find_symbol_definition(
    repo_path: String,
    symbol: String,
    language_hint: String,
) -> Result<Vec<DefinitionResult>, String> {
    // Build language-specific definition patterns
    let patterns = build_definition_patterns(&symbol, &language_hint);
    if patterns.is_empty() {
        return Ok(vec![]);
    }

    let file_extensions = extensions_for_language(&language_hint);

    let mut all_results = Vec::new();
    let glob_args: Vec<String> = file_extensions.iter().map(|ext| format!("*.{}", ext)).collect();
    for pattern in &patterns {
        // --no-index searches all files including untracked ones
        let mut args = vec![
            "-C".to_string(), repo_path.clone(),
            "grep".to_string(), "--no-index".to_string(),
            "-rn".to_string(), "-P".to_string(), pattern.clone(),
            "--".to_string(),
        ];
        for g in &glob_args {
            args.push(g.clone());
        }

        if let Some(output) = Command::new("git").args(&args).output().ok() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines().take(20) {
                if let Some(result) = parse_grep_line(line, &repo_path) {
                    if !is_test_file(&result.file) {
                        all_results.push(result);
                    }
                }
            }
        }
    }

    // Deduplicate by file:line
    all_results.sort_by(|a, b| (&a.file, a.line_number).cmp(&(&b.file, b.line_number)));
    all_results.dedup_by(|a, b| a.file == b.file && a.line_number == b.line_number);
    all_results.truncate(10);

    // Read context for each result
    for result in &mut all_results {
        if let Ok((before, after)) = read_context(&repo_path, &result.file, result.line_number) {
            result.context_before = before;
            result.context_after = after;
        }
    }

    Ok(all_results)
}

fn escape_regex(s: &str) -> String {
    let mut result = String::with_capacity(s.len() * 2);
    for c in s.chars() {
        if "\\^$.|?*+()[]{}".contains(c) {
            result.push('\\');
        }
        result.push(c);
    }
    result
}

fn build_definition_patterns(symbol: &str, language: &str) -> Vec<String> {
    let s = escape_regex(symbol);
    // Use a single broad pattern that catches definitions across languages.
    // The -P flag (PCRE) is used for \s and \b support.
    match language {
        "typescript" | "tsx" | "javascript" | "jsx" => vec![
            format!(r"(function|const|let|var|class|interface|type|enum)\s+{}\b", s),
        ],
        "rust" => vec![
            format!(r"(pub\s+)?(fn|struct|enum|trait|type|const|static|mod)\s+{}\b", s),
        ],
        "python" => vec![
            format!(r"(def|class)\s+{}\b", s),
        ],
        "go" => vec![
            format!(r"(func|type|var)\s+.*?{}\b", s),
        ],
        "swift" => vec![
            format!(r"(func|class|struct|enum|protocol|let|var)\s+{}\b", s),
        ],
        "kotlin" | "java" => vec![
            format!(r"(fun|class|interface|val|var|object)\s+{}\b", s),
        ],
        _ => vec![
            format!(r"(function|def|fn|func|class|struct|interface|type|const|let|var|val|enum)\s+{}\b", s),
        ],
    }
}

fn extensions_for_language(language: &str) -> Vec<&'static str> {
    match language {
        "typescript" => vec!["ts", "tsx"],
        "tsx" => vec!["ts", "tsx"],
        "javascript" => vec!["js", "jsx", "mjs"],
        "jsx" => vec!["js", "jsx"],
        "rust" => vec!["rs"],
        "python" => vec!["py"],
        "go" => vec!["go"],
        "swift" => vec!["swift"],
        "kotlin" => vec!["kt", "kts"],
        "java" => vec!["java"],
        _ => vec!["ts", "tsx", "js", "jsx", "py", "rs", "go"],
    }
}

fn parse_grep_line(line: &str, _repo_path: &str) -> Option<DefinitionResult> {
    // Format: "file:line_number:content" (relative paths from git grep)
    let first_colon = line.find(':')?;
    let file = &line[..first_colon];
    let rest = &line[first_colon + 1..];
    let second_colon = rest.find(':')?;
    let line_num: u32 = rest[..second_colon].parse().ok()?;
    let content = rest[second_colon + 1..].trim().to_string();

    Some(DefinitionResult {
        file: file.to_string(),
        line_number: line_num,
        line_content: content,
        context_before: vec![],
        context_after: vec![],
    })
}

fn read_context(repo_path: &str, file: &str, line_number: u32) -> Result<(Vec<String>, Vec<String>), String> {
    let file_path = std::path::Path::new(repo_path).join(file);
    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    let all_lines: Vec<&str> = content.lines().collect();

    let idx = (line_number as usize).saturating_sub(1); // 0-based
    let start_before = idx.saturating_sub(5);
    let end_after = (idx + 16).min(all_lines.len());

    let before: Vec<String> = all_lines[start_before..idx].iter().map(|s| s.to_string()).collect();
    let after: Vec<String> = all_lines[idx + 1..end_after].iter().map(|s| s.to_string()).collect();

    Ok((before, after))
}

#[tauri::command]
pub async fn read_file_range(
    repo_path: String,
    file: String,
    start_line: u32,
    end_line: u32,
) -> Result<String, String> {
    let file_path = std::path::Path::new(&repo_path).join(&file);
    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    let lines: Vec<&str> = content.lines().collect();

    let start = (start_line as usize).saturating_sub(1);
    let end = (end_line as usize).min(lines.len());

    Ok(lines[start..end].join("\n"))
}
