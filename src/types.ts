export interface FileStat {
  path: string;
  added: number;
  removed: number;
  untracked: boolean;
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
}

export interface TestsResult {
  test_cases: TestCase[];
}

export interface DiagramsResult {
  before: string;
  after: string;
  combined: string;
}

export type TabName = "delta" | "summary" | "tests" | "diagrams";
