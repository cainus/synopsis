import { useState, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FolderPicker } from "./components/FolderPicker";
import { DeltaTab } from "./components/DeltaTab";
import { SummaryTab } from "./components/SummaryTab";
import { DetailsTab } from "./components/DetailsTab";
import { TestsTab } from "./components/TestsTab";
import { DiagramsTab } from "./components/DiagramsTab";
import { useRepo } from "./hooks/useRepo";
import type { TabName } from "./types";

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
    (tab: string) => {
      const t = tab as TabName;
      setActiveTab(t);
      if (t === "summary") fetchSummary();
      if (t === "details") fetchDetails();
      if (t === "tests") fetchTests();
      if (t === "diagrams") fetchDiagrams();
    },
    [fetchSummary, fetchDetails, fetchTests, fetchDiagrams]
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="flex items-center gap-4 px-4 py-3 bg-card border-b border-border shrink-0">
        <h1 className="text-base font-semibold text-foreground tracking-wide">Synopsis</h1>
        <FolderPicker repoPath={repoPath} onPick={setRepoPath} onRefresh={refresh} recentPaths={recentPaths} />
      </header>

      {error && (
        <div className="bg-destructive/20 text-destructive px-4 py-2 text-sm shrink-0">
          {error}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col flex-1 min-h-0">
        <TabsList className="w-full justify-start rounded-none border-b border-border bg-card h-auto p-0">
          {(["summary", "details", "delta", "tests", "diagrams"] as const).map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground text-muted-foreground px-5 py-2.5 text-sm font-medium"
            >
              {tab === "delta" ? "Files" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              {loading[tab] && (
                <span className="ml-1.5 inline-block w-2.5 h-2.5 border-[1.5px] border-muted border-t-primary rounded-full animate-spin" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="summary" className="flex-1 overflow-auto p-4 mt-0">
          <SummaryTab result={summaryResult} loading={loading.summary} hasRepo={!!repoPath} onGenerate={fetchSummary} />
        </TabsContent>
        <TabsContent value="details" className="flex-1 overflow-auto p-4 mt-0">
          <DetailsTab result={detailsResult} loading={loading.details} hasRepo={!!repoPath} onGenerate={fetchDetails} repoPath={repoPath} />
        </TabsContent>
        <TabsContent value="delta" className="flex-1 overflow-auto p-4 mt-0">
          <DeltaTab result={deltaResult} loading={loading.delta} repoPath={repoPath} />
        </TabsContent>
        <TabsContent value="tests" className="flex-1 overflow-auto p-4 mt-0">
          <TestsTab result={testsResult} loading={loading.tests} hasRepo={!!repoPath} />
        </TabsContent>
        <TabsContent value="diagrams" className="flex-1 overflow-auto p-4 mt-0">
          <DiagramsTab result={diagramsResult} loading={loading.diagrams} hasRepo={!!repoPath} onGenerate={fetchDiagrams} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default App;
