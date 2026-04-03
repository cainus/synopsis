export interface FileStat {
  path: string;
  added: number;
  removed: number;
  untracked: boolean;
  status: "added" | "deleted" | "modified";
}

export interface DeltaResult {
  default_branch: string;
  current_branch: string;
  files: FileStat[];
}

export interface TestCase {
  full_name: string;
  file: string;
  behaviour_change: string;
  snippet: string;
}

export interface TestsResult {
  test_cases: TestCase[];
}

export interface FileSnippet {
  file: string;
  snippet: string;
}

export interface SummaryChangeItem {
  title: string;
  children: SummaryChangeItem[];
  files: FileSnippet[];
}

export interface SummaryBullet {
  label: string;
  text: string;
}

export interface SummaryResult {
  headline: string;
  bullets: SummaryBullet[];
}

export interface DetailsResult {
  product_changes: SummaryChangeItem[];
  technical_changes: SummaryChangeItem[];
}

export interface DiagramsResult {
  before: string;
  after: string;
  before_caption: string;
  after_caption: string;
}

export type TabName = "summary" | "details" | "delta" | "tests" | "diagrams";
