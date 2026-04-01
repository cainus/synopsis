import { useState, useCallback } from "react";
import { FolderPicker } from "./components/FolderPicker";
import { TabBar } from "./components/TabBar";
import { DeltaTab } from "./components/DeltaTab";
import { SummaryTab } from "./components/SummaryTab";
import { DetailsTab } from "./components/DetailsTab";
import { TestsTab } from "./components/TestsTab";
import { DiagramsTab } from "./components/DiagramsTab";
import { useRepo } from "./hooks/useRepo";
import type { TabName } from "./types";
import "./App.css";

function App() {
  const [activeTab, setActiveTab] = useState<TabName>("summary");
  const {
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
  } = useRepo();

  const handleTabChange = useCallback(
    (tab: TabName) => {
      setActiveTab(tab);
      if (tab === "summary") fetchSummary();
      if (tab === "details") fetchDetails();
      if (tab === "tests") fetchTests();
      if (tab === "diagrams") fetchDiagrams();
    },
    [fetchSummary, fetchDetails, fetchTests, fetchDiagrams]
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>Synopsis</h1>
        <FolderPicker repoPath={repoPath} onPick={setRepoPath} onRefresh={refresh} recentPaths={recentPaths} />
      </header>

      {error && <div className="error-bar">{error}</div>}

      <TabBar active={activeTab} onChange={handleTabChange} loading={loading} />

      <main className="tab-content">
        {activeTab === "summary" && (
          <SummaryTab
            result={summaryResult}
            loading={loading.summary}
            hasRepo={!!repoPath}
            onGenerate={fetchSummary}
          />
        )}
        {activeTab === "details" && (
          <DetailsTab
            result={detailsResult}
            loading={loading.details}
            hasRepo={!!repoPath}
            onGenerate={fetchDetails}
          />
        )}
        {activeTab === "delta" && (
          <DeltaTab result={deltaResult} loading={loading.delta} repoPath={repoPath} />
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
