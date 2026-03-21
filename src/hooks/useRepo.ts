import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { DeltaResult, TestsResult } from "../types";

interface Loading {
  delta: boolean;
  summary: boolean;
  tests: boolean;
}

interface RepoState {
  repoPath: string | null;
  setRepoPath: (path: string) => void;
  deltaResult: DeltaResult | null;
  summaryLines: string[];
  summaryDone: boolean;
  testsResult: TestsResult | null;
  loading: Loading;
  error: string | null;
  fetchSummary: () => void;
  fetchTests: () => void;
}

export function useRepo(): RepoState {
  const [repoPath, setRepoPathState] = useState<string | null>(null);
  const [deltaResult, setDeltaResult] = useState<DeltaResult | null>(null);
  const [summaryLines, setSummaryLines] = useState<string[]>([]);
  const [summaryDone, setSummaryDone] = useState(false);
  const [testsResult, setTestsResult] = useState<TestsResult | null>(null);
  const [loading, setLoading] = useState<Loading>({
    delta: false,
    summary: false,
    tests: false,
  });
  const [error, setError] = useState<string | null>(null);

  const summaryFetched = useRef(false);
  const testsFetched = useRef(false);
  const unlistenSummaryChunk = useRef<UnlistenFn | null>(null);
  const unlistenSummaryDone = useRef<UnlistenFn | null>(null);

  function setRepoPath(path: string) {
    setRepoPathState(path);
    setDeltaResult(null);
    setSummaryLines([]);
    setSummaryDone(false);
    setTestsResult(null);
    setError(null);
    summaryFetched.current = false;
    testsFetched.current = false;
  }

  // Eagerly fetch delta when repoPath changes
  useEffect(() => {
    if (!repoPath) return;
    setLoading((l) => ({ ...l, delta: true }));
    invoke<DeltaResult>("get_delta", { repoPath })
      .then((result) => setDeltaResult(result))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading((l) => ({ ...l, delta: false })));
  }, [repoPath]);

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

  return {
    repoPath,
    setRepoPath,
    deltaResult,
    summaryLines,
    summaryDone,
    testsResult,
    loading,
    error,
    fetchSummary,
    fetchTests,
  };
}
