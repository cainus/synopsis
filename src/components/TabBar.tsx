import type { TabName } from "../types";

interface Props {
  active: TabName;
  onChange: (tab: TabName) => void;
}

const TABS: { id: TabName; label: string }[] = [
  { id: "delta", label: "Delta" },
  { id: "summary", label: "Summary" },
  { id: "tests", label: "Tests" },
  { id: "diagrams", label: "Diagrams" },
];

export function TabBar({ active, onChange }: Props) {
  return (
    <div className="tab-bar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`tab-btn${active === tab.id ? " active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
