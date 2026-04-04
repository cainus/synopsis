pub fn extract_json_object(s: &str) -> String {
    let s = s.trim();
    if let Some(start) = s.find('{') {
        if let Some(end) = s.rfind('}') {
            return s[start..=end].to_string();
        }
    }
    s.to_string()
}

pub fn extract_json_array(s: &str) -> String {
    // Strip markdown code fences if present
    let s = s.trim();
    let s = if let Some(start) = s.find('[') {
        if let Some(end) = s.rfind(']') {
            &s[start..=end]
        } else {
            s
        }
    } else {
        s
    };
    s.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_json_array_bare() {
        let input = r#"[{"full_name":"foo","behaviour_change":"bar"}]"#;
        assert_eq!(extract_json_array(input), input);
    }

    #[test]
    fn test_extract_json_array_strips_markdown_fence() {
        let input = "```json\n[{\"full_name\":\"foo\",\"behaviour_change\":\"bar\"}]\n```";
        assert_eq!(
            extract_json_array(input),
            r#"[{"full_name":"foo","behaviour_change":"bar"}]"#
        );
    }

    #[test]
    fn test_extract_json_array_leading_text() {
        let input = "Here is the result:\n[{\"a\":\"b\"}]";
        assert_eq!(extract_json_array(input), r#"[{"a":"b"}]"#);
    }
}
