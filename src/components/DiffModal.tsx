import { useEffect, useRef, useState } from "react";

type ViewMode = "inline" | "side-by-side";

interface Props {
  diff: string;
  title: string;
  onClose: () => void;
}

function InlineView({ lines }: { lines: string[] }) {
  return (
    <pre className="diff-content">
      {lines.map((line, i) => (
        <DiffLine key={i} line={line} />
      ))}
    </pre>
  );
}

function SideBySideView({ lines }: { lines: string[] }) {
  const left: { line: string; cls: string }[] = [];
  const right: { line: string; cls: string }[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("@@") || line.startsWith("diff ") || line.startsWith("---") || line.startsWith("+++") || line.startsWith("index ")) {
      left.push({ line, cls: classFor(line) });
      right.push({ line, cls: classFor(line) });
      i++;
    } else if (line.startsWith("-")) {
      // Collect consecutive removes then adds to pair them
      const removes: string[] = [];
      while (i < lines.length && lines[i].startsWith("-") && !lines[i].startsWith("---")) {
        removes.push(lines[i].slice(1));
        i++;
      }
      const adds: string[] = [];
      while (i < lines.length && lines[i].startsWith("+") && !lines[i].startsWith("+++")) {
        adds.push(lines[i].slice(1));
        i++;
      }
      const max = Math.max(removes.length, adds.length);
      for (let j = 0; j < max; j++) {
        left.push(j < removes.length
          ? { line: removes[j], cls: "diff-remove" }
          : { line: "", cls: "diff-empty" });
        right.push(j < adds.length
          ? { line: adds[j], cls: "diff-add" }
          : { line: "", cls: "diff-empty" });
      }
    } else if (line.startsWith("+")) {
      left.push({ line: "", cls: "diff-empty" });
      right.push({ line: line.slice(1), cls: "diff-add" });
      i++;
    } else {
      // Context line
      const text = line.startsWith(" ") ? line.slice(1) : line;
      left.push({ line: text, cls: "diff-line" });
      right.push({ line: text, cls: "diff-line" });
      i++;
    }
  }

  return (
    <div className="diff-side-by-side">
      <pre className="diff-side-pane">
        {left.map((entry, j) => (
          <div key={j} className={entry.cls}>{entry.line || "\n"}</div>
        ))}
      </pre>
      <pre className="diff-side-pane">
        {right.map((entry, j) => (
          <div key={j} className={entry.cls}>{entry.line || "\n"}</div>
        ))}
      </pre>
    </div>
  );
}

function classFor(line: string): string {
  if (line.startsWith("+") && !line.startsWith("+++")) return "diff-add";
  if (line.startsWith("-") && !line.startsWith("---")) return "diff-remove";
  if (line.startsWith("@@")) return "diff-hunk";
  if (line.startsWith("diff ")) return "diff-header";
  return "diff-line";
}

function DiffLine({ line }: { line: string }) {
  return <div className={classFor(line)}>{line || "\n"}</div>;
}

export function DiffModal({ diff, title, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ViewMode>("inline");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  const lines = diff.split("\n");

  return (
    <div className="diff-modal-backdrop" ref={backdropRef} onClick={handleBackdropClick}>
      <div className={`diff-modal${mode === "side-by-side" ? " diff-modal-wide" : ""}`}>
        <div className="diff-modal-header">
          <span className="diff-modal-title">{title}</span>
          <div className="diff-modal-controls">
            <div className="diff-mode-toggle">
              <button
                className={`diff-mode-btn${mode === "inline" ? " active" : ""}`}
                onClick={() => setMode("inline")}
              >Inline</button>
              <button
                className={`diff-mode-btn${mode === "side-by-side" ? " active" : ""}`}
                onClick={() => setMode("side-by-side")}
              >Side by side</button>
            </div>
            <button className="diff-modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="diff-modal-body">
          {mode === "inline"
            ? <InlineView lines={lines} />
            : <SideBySideView lines={lines} />}
        </div>
      </div>
    </div>
  );
}
