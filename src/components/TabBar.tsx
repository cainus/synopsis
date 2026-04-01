import type { TabName } from "../types";

interface Props {
  active: TabName;
  onChange: (tab: TabName) => void;
  loading?: Partial<Record<TabName, boolean>>;
}

const TABS: { id: TabName; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "details", label: "Details" },
  { id: "delta", label: "Files" },
  { id: "tests", label: "Tests" },
  { id: "diagrams", label: "Diagrams" },
];

export function TabBar({ active, onChange, loading = {} }: Props) {
  return (
    <div className="tab-bar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`tab-btn${active === tab.id ? " active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {loading[tab.id] && <span className="tab-spinner" />}
        </button>
      ))}
    </div>
  );
}
