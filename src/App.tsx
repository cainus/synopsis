import { useState, useCallback } from "react";
import { FolderPicker } from "./components/FolderPicker";
import { TabBar } from "./components/TabBar";
import { DeltaTab } from "./components/DeltaTab";
import { SummaryTab } from "./components/SummaryTab";
import { TestsTab } from "./components/TestsTab";
import { DiagramsTab } from "./components/DiagramsTab";
import { useRepo } from "./hooks/useRepo";
import type { TabName } from "./types";
import "./App.css";

function App() {
  const [activeTab, setActiveTab] = useState<TabName>("delta");
  const {
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
  } = useRepo();

  const handleTabChange = useCallback(
    (tab: TabName) => {
      setActiveTab(tab);
      if (tab === "summary") fetchSummary();
      if (tab === "tests") fetchTests();
      if (tab === "diagrams") fetchDiagrams();
    },
    [fetchSummary, fetchTests]
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>Synopsis</h1>
        <FolderPicker repoPath={repoPath} onPick={setRepoPath} onRefresh={refresh} recentPaths={recentPaths} />
      </header>

      {error && <div className="error-bar">{error}</div>}

      <TabBar active={activeTab} onChange={handleTabChange} />

      <main className="tab-content">
        {activeTab === "delta" && (
          <DeltaTab result={deltaResult} loading={loading.delta} />
        )}
        {activeTab === "summary" && (
          <SummaryTab
            lines={summaryLines}
            loading={loading.summary}
            done={summaryDone}
            hasRepo={!!repoPath}
            onGenerate={fetchSummary}
          />
        )}
        {activeTab === "tests" && (
          <TestsTab
            result={testsResult}
            loading={loading.tests}
            hasRepo={!!repoPath}
          />
        )}
        {activeTab === "diagrams" && (
          <DiagramsTab
            result={diagramsResult}
            loading={loading.diagrams}
            hasRepo={!!repoPath}
            onGenerate={fetchDiagrams}
          />
        )}
      </main>
    </div>
  );
}

export default App;
