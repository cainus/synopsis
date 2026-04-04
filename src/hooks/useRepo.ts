import React, { useState, useEffect, useRef } from "react";
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

  function makeFetcher<T>(
    key: keyof Loading,
    command: string,
    setter: (result: T) => void,
    fetched: React.MutableRefObject<boolean>,
    after?: () => void,
  ) {
    return () => {
      if (!repoPath || fetched.current) return;
      fetched.current = true;
      setLoading((l) => ({ ...l, [key]: true }));
      invoke<T>(command, { repoPath })
        .then((result) => { setter(result); after?.(); })
        .catch((e) => setError(String(e)))
        .finally(() => setLoading((l) => ({ ...l, [key]: false })));
    };
  }

  const fetchDetails = makeFetcher<DetailsResult>("details", "get_details", setDetailsResult, detailsFetched);
  const fetchTests = makeFetcher<TestsResult>("tests", "get_tests_result", setTestsResult, testsFetched);
  const fetchDiagrams = makeFetcher<DiagramsResult>("diagrams", "get_diagrams", setDiagramsResult, diagramsFetched);
  const fetchSummary = makeFetcher<SummaryResult>("summary", "get_summary", setSummaryResult, summaryFetched, () => fetchDetails());

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
