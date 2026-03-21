export interface FileStat {
  path: string;
  added: number;
  removed: number;
}

export interface DeltaResult {
  default_branch: string;
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

export type TabName = "delta" | "summary" | "tests";
