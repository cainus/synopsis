import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { DeltaResult, DiagramsResult, TestsResult } from "../types";

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
  tests: boolean;
  diagrams: boolean;
}

interface RepoState {
  repoPath: string | null;
  setRepoPath: (path: string) => void;
  refresh: () => void;
  recentPaths: string[];
  deltaResult: DeltaResult | null;
  summaryLines: string[];
  summaryDone: boolean;
  testsResult: TestsResult | null;
  diagramsResult: DiagramsResult | null;
  loading: Loading;
  error: string | null;
  fetchSummary: () => void;
  fetchTests: () => void;
  fetchDiagrams: () => void;
}

export function useRepo(): RepoState {
  const initialRecents = loadRecents();
  const [recentPaths, setRecentPaths] = useState<string[]>(initialRecents);
  const [repoPath, setRepoPathState] = useState<string | null>(initialRecents[0] ?? null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deltaResult, setDeltaResult] = useState<DeltaResult | null>(null);
  const [summaryLines, setSummaryLines] = useState<string[]>([]);
  const [summaryDone, setSummaryDone] = useState(false);
  const [testsResult, setTestsResult] = useState<TestsResult | null>(null);
  const [diagramsResult, setDiagramsResult] = useState<DiagramsResult | null>(null);
  const [loading, setLoading] = useState<Loading>({
    delta: false,
    summary: false,
    tests: false,
    diagrams: false,
  });
  const [error, setError] = useState<string | null>(null);

  const summaryFetched = useRef(false);
  const testsFetched = useRef(false);
  const diagramsFetched = useRef(false);
  const unlistenSummaryChunk = useRef<UnlistenFn | null>(null);
  const unlistenSummaryDone = useRef<UnlistenFn | null>(null);

  function resetState() {
    setDeltaResult(null);
    setSummaryLines([]);
    setSummaryDone(false);
    setTestsResult(null);
    setDiagramsResult(null);
    setError(null);
    summaryFetched.current = false;
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

  // Eagerly fetch delta when repoPath changes or refresh is triggered
  useEffect(() => {
    if (!repoPath) return;
    setLoading((l) => ({ ...l, delta: true }));
    invoke<DeltaResult>("get_delta", { repoPath })
      .then((result) => setDeltaResult(result))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading((l) => ({ ...l, delta: false })));
  }, [repoPath, refreshKey]);

  function fetchSummary() {
    if (!repoPath || summaryFetched.current) return;
    summaryFetched.current = true;
    setSummaryLines([]);
    setSummaryDone(false);
    setLoading((l) => ({ ...l, summary: true }));

    // Clean up old listeners
    unlistenSummaryChunk.current?.();
    unlistenSummaryDone.current?.();

    listen<string>("summary-chunk", (event) => {
      setSummaryLines((lines) => [...lines, event.payload]);
    }).then((fn) => {
      unlistenSummaryChunk.current = fn;
    });

    listen("summary-done", () => {
      setSummaryDone(true);
      setLoading((l) => ({ ...l, summary: false }));
      unlistenSummaryChunk.current?.();
      unlistenSummaryDone.current?.();
    }).then((fn) => {
      unlistenSummaryDone.current = fn;
    });

    invoke("get_summary", { repoPath }).catch((e) => {
      setError(String(e));
      setLoading((l) => ({ ...l, summary: false }));
    });
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
    summaryLines,
    summaryDone,
    testsResult,
    diagramsResult,
    loading,
    error,
    fetchSummary,
    fetchTests,
    fetchDiagrams,
  };
}
