import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DeltaResult, DetailsResult, DiagramsResult, SummaryResult, TestsResult } from "../types";

const RECENTS_KEY = "synopsis_recent_paths";
const MAX_RECENTS = 5;

function loadRecents(): string[] {
  try {
    const saved = localStorage.getItem(RECENTS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveRecents(paths: string[]) {
  localStorage.setItem(RECENTS_KEY, JSON.stringify(paths));
}

interface Loading {
  delta: boolean;
  summary: boolean;
  details: boolean;
  tests: boolean;
  diagrams: boolean;
}

interface RepoState {
  repoPath: string | null;
  setRepoPath: (path: string) => void;
  refresh: () => void;
  recentPaths: string[];
  deltaResult: DeltaResult | null;
  summaryResult: SummaryResult | null;
  detailsResult: DetailsResult | null;
  testsResult: TestsResult | null;
  diagramsResult: DiagramsResult | null;
  loading: Loading;
  error: string | null;
  fetchSummary: () => void;
  fetchDetails: () => void;
  fetchTests: () => void;
  fetchDiagrams: () => void;
}

export function useRepo(): RepoState {
  const initialRecents = loadRecents();
  const [recentPaths, setRecentPaths] = useState<string[]>(initialRecents);
  const [repoPath, setRepoPathState] = useState<string | null>(initialRecents[0] ?? null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deltaResult, setDeltaResult] = useState<DeltaResult | null>(null);
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [detailsResult, setDetailsResult] = useState<DetailsResult | null>(null);
  const [testsResult, setTestsResult] = useState<TestsResult | null>(null);
  const [diagramsResult, setDiagramsResult] = useState<DiagramsResult | null>(null);
  const [loading, setLoading] = useState<Loading>({
    delta: false,
    summary: false,
    details: false,
    tests: false,
    diagrams: false,
  });
  const [error, setError] = useState<string | null>(null);

  const summaryFetched = useRef(false);
  const detailsFetched = useRef(false);
  const testsFetched = useRef(false);
  const diagramsFetched = useRef(false);

  function resetState() {
    setDeltaResult(null);
    setSummaryResult(null);
    setDetailsResult(null);
    setTestsResult(null);
    setDiagramsResult(null);
    setError(null);
    summaryFetched.current = false;
    detailsFetched.current = false;
    testsFetched.current = false;
    diagramsFetched.current = false;
  }

  function setRepoPath(path: string) {
    setRepoPathState(path);
    resetState();
    setRecentPaths((prev) => {
      const updated = [path, ...prev.filter((p) => p !== path)].slice(0, MAX_RECENTS);
      saveRecents(updated);
      return updated;
    });
  }

  function refresh() {
    if (!repoPath) return;
    resetState();
    setRefreshKey((k) => k + 1);
  }

  // Eagerly fetch delta and summary when repoPath changes or refresh is triggered
  useEffect(() => {
    if (!repoPath) return;
    setLoading((l) => ({ ...l, delta: true }));
    invoke<DeltaResult>("get_delta", { repoPath })
      .then((result) => setDeltaResult(result))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading((l) => ({ ...l, delta: false })));
    fetchSummary();
  }, [repoPath, refreshKey]);

  function fetchSummary() {
    if (!repoPath || summaryFetched.current) return;
    summaryFetched.current = true;
    setLoading((l) => ({ ...l, summary: true }));
    invoke<SummaryResult>("get_summary", { repoPath })
      .then((result) => {
        setSummaryResult(result);
        fetchDetails();
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading((l) => ({ ...l, summary: false })));
  }

  function fetchDetails() {
    if (!repoPath || detailsFetched.current) return;
    detailsFetched.current = true;
    setLoading((l) => ({ ...l, details: true }));
    invoke<DetailsResult>("get_details", { repoPath })
      .then((result) => setDetailsResult(result))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading((l) => ({ ...l, details: false })));
  }

  function fetchTests() {
    if (!repoPath || testsFetched.current) return;
    testsFetched.current = true;
    setLoading((l) => ({ ...l, tests: true }));
    invoke<TestsResult>("get_tests_result", { repoPath })
      .then((result) => setTestsResult(result))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading((l) => ({ ...l, tests: false })));
  }

  function fetchDiagrams() {
    if (!repoPath || diagramsFetched.current) return;
    diagramsFetched.current = true;
    setLoading((l) => ({ ...l, diagrams: true }));
    invoke<DiagramsResult>("get_diagrams", { repoPath })
      .then((result) => setDiagramsResult(result))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading((l) => ({ ...l, diagrams: false })));
  }

  return {
    repoPath,
    setRepoPath,
    refresh,
    recentPaths,
    deltaResult,
    summaryResult,
    detailsResult,
    testsResult,
    diagramsResult,
    loading,
    error,
    fetchSummary,
    fetchDetails,
    fetchTests,
    fetchDiagrams,
  };
}
