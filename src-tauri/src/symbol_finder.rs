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
    let glob_args: Vec<String> = file_extensions.iter().map(|ext| format!("*.{}", ext)).collect();

    // Run all patterns in parallel using JoinSet
    let mut join_set = tokio::task::JoinSet::new();
    for pattern in patterns {
        let repo = repo_path.clone();
        let globs = glob_args.clone();
        join_set.spawn(async move {
            let mut args = vec![
                "-C".to_string(), repo.clone(),
                "grep".to_string(),
                "-n".to_string(), "-P".to_string(), pattern.clone(),
                "--".to_string(),
            ];
            for g in &globs {
                args.push(g.clone());
            }

            let output = tokio::process::Command::new("git")
                .args(&args)
                .output()
                .await
                .ok();

            let mut results = Vec::new();
            if let Some(ref output) = output {
                if !output.status.success() && output.status.code() != Some(1) {
                    eprintln!("[synopsis] git grep failed: args={:?}, exit={:?}, stderr={}",
                        args, output.status.code(), String::from_utf8_lossy(&output.stderr));
                }
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines().take(20) {
                    if let Some(result) = parse_grep_line(line, &repo) {
                        if !is_test_file(&result.file) {
                            results.push(result);
                        }
                    }
                }
            }
            results
        });
    }

    let mut all_results = Vec::new();
    while let Some(result) = join_set.join_next().await {
        if let Ok(results) = result {
            all_results.extend(results);
        }
    }

    // Deduplicate by file:line
    all_results.sort_by(|a, b| (&a.file, a.line_number).cmp(&(&b.file, b.line_number)));
    all_results.dedup_by(|a, b| a.file == b.file && a.line_number == b.line_number);
    all_results.truncate(10);

    // Read context for each result in parallel
    let mut context_set = tokio::task::JoinSet::new();
    for (i, result) in all_results.iter().enumerate() {
        let repo = repo_path.clone();
        let file = result.file.clone();
        let line_number = result.line_number;
        context_set.spawn(async move {
            let ctx = read_context(&repo, &file, line_number).ok();
            (i, ctx)
        });
    }
    while let Some(result) = context_set.join_next().await {
        if let Ok((i, Some((before, after)))) = result {
            all_results[i].context_before = before;
            all_results[i].context_after = after;
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
    let method_modifier_pattern = format!(
        r"(public|private|protected|static|override|abstract|async|get|set)\s+(?:(?:static|async|get|set)\s+)*{}\s*[\(<]", s
    );
    match language {
        "typescript" | "tsx" | "javascript" | "jsx" => vec![
            format!(r"(function|const|let|var|class|interface|type|enum)\s+{}\b", s),
            method_modifier_pattern.clone(),
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
            method_modifier_pattern,
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
    fn git(dir: &std::path::Path, args: &[&str]) -> std::process::Output {
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

    // ── Test 1: find_definition_typescript ──────────────────────────────────

    #[test]
    fn test_find_definition_typescript() {
        let dir = make_temp_dir("find_def_ts");

        // git init
        git(&dir, &["init"]);

        // Create source file
        let src_dir = dir.join("src");
        std::fs::create_dir_all(&src_dir).unwrap();
        std::fs::write(
            src_dir.join("utils.ts"),
            "export function calculateTotal(items: number[]): number { return items.reduce((a, b) => a + b, 0); }\n",
        ).unwrap();

        // Create test file
        std::fs::write(
            src_dir.join("utils.test.ts"),
            "import { calculateTotal } from './utils';\ntest('adds numbers', () => { expect(calculateTotal([1,2])).toBe(3); });\n",
        ).unwrap();

        // git add & commit (required for git grep without --no-index)
        git(&dir, &["add", "."]);
        git(&dir, &["-c", "commit.gpgsign=false", "commit", "-m", "init"]);

        // Build patterns
        let patterns = build_definition_patterns("calculateTotal", "typescript");
        assert!(!patterns.is_empty(), "patterns should not be empty");

        // Run git grep (uses the index, no --no-index)
        let pattern = &patterns[0];
        let output = Command::new("git")
            .args(&[
                "-C", dir.to_str().unwrap(),
                "grep", "-n", "-P", pattern,
                "--", "*.ts", "*.tsx",
            ])
            .output()
            .expect("git grep failed");
        let stdout = String::from_utf8_lossy(&output.stdout);

        // Parse results
        let results: Vec<DefinitionResult> = stdout
            .lines()
            .filter_map(|line| parse_grep_line(line, dir.to_str().unwrap()))
            .collect();

        // Should find at least one result
        assert!(!results.is_empty(), "should find calculateTotal definition");

        // Filter out test files, just like the real function does
        let non_test: Vec<&DefinitionResult> = results.iter().filter(|r| !is_test_file(&r.file)).collect();
        let test_only: Vec<&DefinitionResult> = results.iter().filter(|r| is_test_file(&r.file)).collect();

        assert!(!non_test.is_empty(), "should find calculateTotal in src/utils.ts");
        assert!(non_test.iter().any(|r| r.file.contains("utils.ts")), "should match utils.ts");

        // The test file references calculateTotal but not as a definition pattern
        // (import is not in function|const|let|var|class|interface|type|enum)
        // so it shouldn't appear in results at all. But if it did, is_test_file filters it.
        for r in &test_only {
            assert!(is_test_file(&r.file), "test file should be detected by is_test_file");
        }

        cleanup(&dir);
    }

    // ── Test 2: find_definition_committed_file ──────────────────────────────

    #[test]
    fn test_find_definition_committed_file() {
        let dir = make_temp_dir("find_def_committed");

        // git init and commit a file
        git(&dir, &["init"]);

        let src_dir = dir.join("src");
        std::fs::create_dir_all(&src_dir).unwrap();
        std::fs::write(
            src_dir.join("helper.ts"),
            "export function myHelper(x: number): number { return x * 2; }\n",
        ).unwrap();

        git(&dir, &["add", "."]);
        git(&dir, &["-c", "commit.gpgsign=false", "commit", "-m", "init"]);

        // Build pattern and run git grep (should find committed files)
        let patterns = build_definition_patterns("myHelper", "typescript");
        let pattern = &patterns[0];
        let output = Command::new("git")
            .args(&[
                "-C", dir.to_str().unwrap(),
                "grep", "-n", "-P", pattern,
                "--", "*.ts", "*.tsx",
            ])
            .output()
            .expect("git grep failed");
        let stdout = String::from_utf8_lossy(&output.stdout);

        let results: Vec<DefinitionResult> = stdout
            .lines()
            .filter_map(|line| parse_grep_line(line, dir.to_str().unwrap()))
            .collect();

        assert!(!results.is_empty(), "git grep should find committed files");
        assert!(results.iter().any(|r| r.file.contains("helper.ts")));

        cleanup(&dir);
    }

    // ── Test 3: build_definition_patterns_typescript ─────────────────────────

    #[test]
    fn test_build_definition_patterns_typescript() {
        let patterns = build_definition_patterns("myFunc", "typescript");
        assert!(patterns.len() >= 1, "should have at least one pattern");
        let p = &patterns[0];
        assert!(p.contains("function"), "should contain 'function'");
        assert!(p.contains("const"), "should contain 'const'");
        assert!(p.contains("let"), "should contain 'let'");
        assert!(p.contains("var"), "should contain 'var'");
        assert!(p.contains("class"), "should contain 'class'");
        assert!(p.contains("interface"), "should contain 'interface'");
        assert!(p.contains("type"), "should contain 'type'");
        assert!(p.contains("enum"), "should contain 'enum'");

        // Symbol with regex special chars should be escaped
        let patterns_special = build_definition_patterns("$value", "typescript");
        let p = &patterns_special[0];
        assert!(p.contains(r"\$value"), "dollar sign should be escaped: {}", p);
    }

    // ── Test 3b: build_definition_patterns_typescript_method_pattern ─────────

    #[test]
    fn test_build_definition_patterns_typescript_has_method_pattern() {
        let patterns = build_definition_patterns("getMtc", "typescript");
        assert!(patterns.len() >= 2, "TS should have at least 2 patterns (declaration + method), got {}", patterns.len());

        // The method pattern should exist and match modifier-prefixed methods
        let method_pattern = &patterns[1];
        let re = regex::Regex::new(method_pattern).expect("method pattern should be valid regex");

        // Should match method definitions with modifiers
        assert!(re.is_match("  static getMtc("), "should match 'static getMtc('");
        assert!(re.is_match("  async getMtc("), "should match 'async getMtc('");
        assert!(re.is_match("  public getMtc("), "should match 'public getMtc('");
        assert!(re.is_match("  private getMtc("), "should match 'private getMtc('");
        assert!(re.is_match("  protected getMtc("), "should match 'protected getMtc('");
        assert!(re.is_match("  get getMtc("), "should match 'get getMtc('");
        assert!(re.is_match("  set getMtc("), "should match 'set getMtc('");
        assert!(re.is_match("  static async getMtc("), "should match 'static async getMtc('");
        assert!(re.is_match("  public static async getMtc("), "should match 'public static async getMtc('");
        assert!(re.is_match("  override getMtc("), "should match 'override getMtc('");
        assert!(re.is_match("  abstract getMtc("), "should match 'abstract getMtc('");
        assert!(re.is_match("  async getMtc<T>("), "should match generic method 'async getMtc<T>('");
    }

    // ── Test 3c: method pattern also works for jsx/tsx/javascript ────────────

    #[test]
    fn test_build_definition_patterns_method_all_js_variants() {
        for lang in &["typescript", "tsx", "javascript", "jsx"] {
            let patterns = build_definition_patterns("doThing", lang);
            assert!(patterns.len() >= 2, "{} should have at least 2 patterns, got {}", lang, patterns.len());
        }
    }

    // ── Test 3d: fallback language also has method pattern ───────────────────

    #[test]
    fn test_build_definition_patterns_fallback_has_method_pattern() {
        let patterns = build_definition_patterns("doThing", "unknown_lang");
        assert!(patterns.len() >= 2, "fallback should have at least 2 patterns, got {}", patterns.len());

        let method_pattern = &patterns[1];
        let re = regex::Regex::new(method_pattern).expect("fallback method pattern should be valid regex");
        assert!(re.is_match("  static doThing("), "fallback should match 'static doThing('");
        assert!(re.is_match("  async doThing("), "fallback should match 'async doThing('");
    }

    // ── Test 4: build_definition_patterns_rust ──────────────────────────────

    #[test]
    fn test_build_definition_patterns_rust() {
        let patterns = build_definition_patterns("MyStruct", "rust");
        assert_eq!(patterns.len(), 1);
        let p = &patterns[0];
        assert!(p.contains("fn"), "should contain 'fn'");
        assert!(p.contains("struct"), "should contain 'struct'");
        assert!(p.contains("enum"), "should contain 'enum'");
        assert!(p.contains("trait"), "should contain 'trait'");
    }

    // ── Test 5: parse_grep_line_valid ────────────────────────────────────────

    #[test]
    fn test_parse_grep_line_valid() {
        let result = parse_grep_line("src/utils.ts:5:export function foo() {", "/some/repo");
        assert!(result.is_some());
        let r = result.unwrap();
        assert_eq!(r.file, "src/utils.ts");
        assert_eq!(r.line_number, 5);
        assert_eq!(r.line_content, "export function foo() {");
    }

    // ── Test 6: parse_grep_line_invalid ──────────────────────────────────────

    #[test]
    fn test_parse_grep_line_invalid() {
        // No colons at all
        assert!(parse_grep_line("no colons here", "/repo").is_none());
        // Only one colon (missing line number section)
        assert!(parse_grep_line("file.ts:not_a_number", "/repo").is_none());
        // Non-numeric line number
        assert!(parse_grep_line("file.ts:abc:content", "/repo").is_none());
    }

    // ── Test 7: extensions_for_language ───────────────────────────────────────

    #[test]
    fn test_extensions_for_language() {
        let ts_exts = extensions_for_language("typescript");
        assert_eq!(ts_exts, vec!["ts", "tsx"]);

        let py_exts = extensions_for_language("python");
        assert_eq!(py_exts, vec!["py"]);

        // Unknown language returns a broad set
        let unknown_exts = extensions_for_language("cobol");
        assert!(unknown_exts.len() > 2, "unknown language should return broad set");
        assert!(unknown_exts.contains(&"ts"));
        assert!(unknown_exts.contains(&"py"));
        assert!(unknown_exts.contains(&"rs"));
    }

    // ── Test 8a: integration — find class method definitions via git grep ────

    #[test]
    fn test_find_class_method_definitions_via_git_grep() {
        let dir = make_temp_dir("find_def_method");
        git(&dir, &["init"]);

        let src_dir = dir.join("src");
        std::fs::create_dir_all(&src_dir).unwrap();
        std::fs::write(
            src_dir.join("service.ts"),
            r#"class MyService {
  private db: Database;

  async getMtc(id: string) {
    return this.db.find(id);
  }

  static fromConfig(config: Config) {
    return new MyService(config);
  }

  get name() {
    return "MyService";
  }
}
"#,
        ).unwrap();

        // Also a file that merely calls getMtc (should NOT match the method pattern ideally)
        std::fs::write(
            src_dir.join("caller.ts"),
            r#"import { svc } from './service';
const result = svc.getMtc("abc");
console.log(result);
"#,
        ).unwrap();

        git(&dir, &["add", "."]);
        git(&dir, &["-c", "commit.gpgsign=false", "commit", "-m", "init"]);

        // Search for getMtc — should find the method definition
        let patterns = build_definition_patterns("getMtc", "typescript");
        let mut found_method = false;

        for pattern in &patterns {
            let output = Command::new("git")
                .args(&[
                    "-C", dir.to_str().unwrap(),
                    "grep", "-n", "-P", pattern,
                    "--", "*.ts", "*.tsx",
                ])
                .output()
                .expect("git grep failed");
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                if let Some(result) = parse_grep_line(line, dir.to_str().unwrap()) {
                    if result.file.contains("service.ts") && result.line_content.contains("getMtc") {
                        found_method = true;
                    }
                }
            }
        }

        assert!(found_method, "should find getMtc method definition in service.ts");
        cleanup(&dir);
    }

    // ── Test 8b: integration — find_symbol_definition async ─────────────────

    #[tokio::test]
    async fn test_find_symbol_definition_async() {
        let dir = make_temp_dir("find_def_async");
        git(&dir, &["init"]);

        let src_dir = dir.join("src");
        std::fs::create_dir_all(&src_dir).unwrap();
        std::fs::write(
            src_dir.join("utils.ts"),
            "export function calculateTotal(items: number[]): number {\n  return items.reduce((a, b) => a + b, 0);\n}\n",
        ).unwrap();

        git(&dir, &["add", "."]);
        git(&dir, &["-c", "commit.gpgsign=false", "commit", "-m", "init"]);

        let results = find_symbol_definition(
            dir.to_str().unwrap().to_string(),
            "calculateTotal".to_string(),
            "typescript".to_string(),
        ).await.expect("find_symbol_definition should succeed");

        assert!(!results.is_empty(), "should find calculateTotal definition");
        assert!(results.iter().any(|r| r.file.contains("utils.ts")));
        // Should have context populated
        let r = &results[0];
        assert!(!r.context_after.is_empty(), "should have context_after populated");

        cleanup(&dir);
    }

    // ── Test 8: escape_regex ─────────────────────────────────────────────────

    #[test]
    fn test_escape_regex() {
        assert_eq!(escape_regex("$foo"), r"\$foo");
        assert_eq!(escape_regex("normal_ident"), "normal_ident");
        assert_eq!(escape_regex("a.b"), r"a\.b");
        assert_eq!(escape_regex("x+y"), r"x\+y");
        assert_eq!(escape_regex("plain"), "plain");
    }
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
