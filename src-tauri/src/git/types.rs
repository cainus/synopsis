#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct FileStat {
    pub path: String,
    pub added: u32,
    pub removed: u32,
    pub untracked: bool,
    pub status: String, // "added", "deleted", "modified"
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct DeltaResult {
    pub default_branch: String,
    pub current_branch: String,
    pub files: Vec<FileStat>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct TestCase {
    pub full_name: String,
    pub file: String,
    pub behaviour_change: String,
    pub snippet: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct TestsResult {
    pub test_cases: Vec<TestCase>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct FileSnippet {
    #[serde(default)]
    pub file: String,
    #[serde(default)]
    pub snippet: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct SummaryChangeItem {
    pub title: String,
    #[serde(default)]
    pub children: Vec<SummaryChangeItem>,
    #[serde(default)]
    pub files: Vec<FileSnippet>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct SummaryBullet {
    pub label: String,
    pub text: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct SummaryResult {
    pub headline: String,
    pub bullets: Vec<SummaryBullet>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct DetailsResult {
    pub product_changes: Vec<SummaryChangeItem>,
    pub technical_changes: Vec<SummaryChangeItem>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct DiagramsResult {
    pub before: String,
    pub after: String,
    pub before_caption: String,
    pub after_caption: String,
}
