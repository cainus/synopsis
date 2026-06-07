import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiffModal } from "./DiffModal";

// Mock Shiki highlighter to avoid async loading
vi.mock("@/hooks/useHighlighter", () => ({
  useHighlighter: () => null,
}));

// Mock DefinitionPeek
vi.mock("./DefinitionPeek", () => ({
  DefinitionPeek: () => null,
}));

const hunkDiff = [
  "@@ -10,3 +10,4 @@ function foo() {",
  " context line",
  "-removed line",
  "+added line",
  "+another added",
].join("\n");

describe("DiffModal hunk header rendering", () => {
  it("does not render hunk header lines in inline view", () => {
    const { baseElement } = render(
      <DiffModal diff={hunkDiff} title="test.ts" onClose={() => {}} />
    );

    const hunkText = "@@ -10,3 +10,4 @@ function foo() {";
    const allDivs = baseElement.querySelectorAll("pre > div");

    // No div should contain hunk header text
    for (const div of allDivs) {
      expect(div.textContent).not.toContain(hunkText);
    }
  });

  it("does not render hunk header lines in side-by-side view", async () => {
    const { baseElement } = render(
      <DiffModal diff={hunkDiff} title="test.ts" onClose={() => {}} />
    );

    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.click(screen.getByText("Side by side"));

    const hunkText = "@@ -10,3 +10,4 @@ function foo() {";
    const allDivs = baseElement.querySelectorAll("pre > div");

    // No div should contain hunk header text
    for (const div of allDivs) {
      expect(div.textContent).not.toContain(hunkText);
    }
  });

  it("still renders content lines with correct line numbers in inline view", () => {
    const { baseElement } = render(
      <DiffModal diff={hunkDiff} title="test.ts" onClose={() => {}} />
    );

    const allDivs = baseElement.querySelectorAll("pre > div");
    // Should have 4 content lines (context, removed, added, added) and no hunk line
    expect(allDivs.length).toBe(4);

    // Check that line numbers are present (hunk said old starts at 10, new starts at 10)
    const textContent = Array.from(allDivs).map((d) => d.textContent);
    // Context line should show old=10 and new=10
    expect(textContent[0]).toContain("10");
    expect(textContent[0]).toContain("context line");
  });

  it("renders all content lines as two-pane rows in side-by-side view", async () => {
    const { baseElement } = render(
      <DiffModal diff={hunkDiff} title="test.ts" onClose={() => {}} />
    );

    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.click(screen.getByText("Side by side"));

    const allRows = baseElement.querySelectorAll("pre > div");

    // All rows should be content rows (no hunk separator rows)
    expect(allRows.length).toBeGreaterThan(0);
    for (const row of allRows) {
      const panes = row.querySelectorAll(":scope > .flex-1");
      expect(panes.length).toBe(2);
    }
  });

  it("does not apply hunk separator styling to added lines", () => {
    const { baseElement } = render(
      <DiffModal diff={hunkDiff} title="test.ts" onClose={() => {}} />
    );

    const allDivs = baseElement.querySelectorAll("pre > div");
    expect(allDivs.length).toBeGreaterThan(0);
    for (const div of allDivs) {
      expect(div.className).not.toContain("italic");
    }
  });
});

const searchDiff = [
  "@@ -1,4 +1,4 @@",
  " const foo = 1;",
  "-const bar = 2;",
  "+const bar = 3;",
  " const baz = 4;",
].join("\n");

describe("DiffModal search", () => {
  it("opens search bar when Cmd+F is pressed", () => {
    render(
      <DiffModal diff={searchDiff} title="test.ts" onClose={() => {}} />
    );

    // Search bar should not be visible initially
    expect(screen.queryByPlaceholderText("Find...")).not.toBeInTheDocument();

    // Press Cmd+F
    fireEvent.keyDown(document, { key: "f", metaKey: true });

    // Search bar should now be visible
    expect(screen.getByPlaceholderText("Find...")).toBeInTheDocument();
  });

  it("opens search bar when Ctrl+F is pressed", () => {
    render(
      <DiffModal diff={searchDiff} title="test.ts" onClose={() => {}} />
    );

    fireEvent.keyDown(document, { key: "f", ctrlKey: true });

    expect(screen.getByPlaceholderText("Find...")).toBeInTheDocument();
  });

  it("focuses input when Cmd+F is pressed while search is already open", () => {
    render(
      <DiffModal diff={searchDiff} title="test.ts" onClose={() => {}} />
    );

    // Open search
    fireEvent.keyDown(document, { key: "f", metaKey: true });
    const input = screen.getByPlaceholderText("Find...");

    // Blur the input
    input.blur();
    expect(document.activeElement).not.toBe(input);

    // Press Cmd+F again
    fireEvent.keyDown(document, { key: "f", metaKey: true });

    // Input should be focused again
    expect(document.activeElement).toBe(input);
  });

  it("shows match count when searching", async () => {
    const user = userEvent.setup();
    render(
      <DiffModal diff={searchDiff} title="test.ts" onClose={() => {}} />
    );

    fireEvent.keyDown(document, { key: "f", metaKey: true });
    const input = screen.getByPlaceholderText("Find...");

    // Search for "const" which appears in all 4 content lines
    await user.type(input, "const");

    expect(screen.getByText("1 of 4")).toBeInTheDocument();
  });

  it("search is case-insensitive", async () => {
    const user = userEvent.setup();
    render(
      <DiffModal diff={searchDiff} title="test.ts" onClose={() => {}} />
    );

    fireEvent.keyDown(document, { key: "f", metaKey: true });
    const input = screen.getByPlaceholderText("Find...");

    await user.type(input, "CONST");

    expect(screen.getByText("1 of 4")).toBeInTheDocument();
  });

  it("searches code content not diff prefixes", async () => {
    const user = userEvent.setup();
    const prefixDiff = [
      "@@ -1,2 +1,2 @@",
      "-old line",
      "+new line",
    ].join("\n");

    render(
      <DiffModal diff={prefixDiff} title="test.ts" onClose={() => {}} />
    );

    fireEvent.keyDown(document, { key: "f", metaKey: true });
    const input = screen.getByPlaceholderText("Find...");

    // Search for "-old" should not match, because the "-" is a diff prefix
    await user.type(input, "-old");
    expect(screen.getByText("0 of 0")).toBeInTheDocument();
  });

  it("closes search bar when close button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <DiffModal diff={searchDiff} title="test.ts" onClose={() => {}} />
    );

    fireEvent.keyDown(document, { key: "f", metaKey: true });
    expect(screen.getByPlaceholderText("Find...")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Close search"));
    expect(screen.queryByPlaceholderText("Find...")).not.toBeInTheDocument();
  });

  it("closes search bar when Escape is pressed in search input, not the modal", async () => {
    const onClose = vi.fn();
    render(
      <DiffModal diff={searchDiff} title="test.ts" onClose={onClose} />
    );

    fireEvent.keyDown(document, { key: "f", metaKey: true });
    const input = screen.getByPlaceholderText("Find...");

    // Press Escape in the search input
    fireEvent.keyDown(input, { key: "Escape" });

    // Search bar should close
    expect(screen.queryByPlaceholderText("Find...")).not.toBeInTheDocument();
    // Modal should NOT close
    expect(onClose).not.toHaveBeenCalled();
  });

  it("highlights matching lines with bg-yellow-500/20", async () => {
    const user = userEvent.setup();
    const { baseElement } = render(
      <DiffModal diff={searchDiff} title="test.ts" onClose={() => {}} />
    );

    fireEvent.keyDown(document, { key: "f", metaKey: true });
    await user.type(screen.getByPlaceholderText("Find..."), "bar");

    // "bar" appears in 2 lines (removed and added)
    // At least 2 lines should have match highlighting (one might have /40 for current)
    const allHighlighted = baseElement.querySelectorAll("[class*='bg-yellow-500']");
    expect(allHighlighted.length).toBe(2);
  });

  it("current match gets stronger highlight bg-yellow-500/40", async () => {
    const user = userEvent.setup();
    const { baseElement } = render(
      <DiffModal diff={searchDiff} title="test.ts" onClose={() => {}} />
    );

    fireEvent.keyDown(document, { key: "f", metaKey: true });
    await user.type(screen.getByPlaceholderText("Find..."), "bar");

    const currentHighlight = baseElement.querySelectorAll(".bg-yellow-500\\/40");
    expect(currentHighlight.length).toBe(1);
  });

  it("navigates to next match with Enter key", async () => {
    const user = userEvent.setup();
    render(
      <DiffModal diff={searchDiff} title="test.ts" onClose={() => {}} />
    );

    fireEvent.keyDown(document, { key: "f", metaKey: true });
    const input = screen.getByPlaceholderText("Find...");
    await user.type(input, "const");

    expect(screen.getByText("1 of 4")).toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(screen.getByText("2 of 4")).toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(screen.getByText("3 of 4")).toBeInTheDocument();
  });

  it("navigates to previous match with Shift+Enter", async () => {
    const user = userEvent.setup();
    render(
      <DiffModal diff={searchDiff} title="test.ts" onClose={() => {}} />
    );

    fireEvent.keyDown(document, { key: "f", metaKey: true });
    const input = screen.getByPlaceholderText("Find...");
    await user.type(input, "const");

    expect(screen.getByText("1 of 4")).toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(screen.getByText("2 of 4")).toBeInTheDocument();

    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(screen.getByText("1 of 4")).toBeInTheDocument();
  });

  it("wraps around when navigating past the last match", async () => {
    const user = userEvent.setup();
    render(
      <DiffModal diff={searchDiff} title="test.ts" onClose={() => {}} />
    );

    fireEvent.keyDown(document, { key: "f", metaKey: true });
    const input = screen.getByPlaceholderText("Find...");
    await user.type(input, "bar");

    // "bar" appears in 2 lines
    expect(screen.getByText("1 of 2")).toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(screen.getByText("2 of 2")).toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
  });

  it("wraps around when navigating before the first match", async () => {
    const user = userEvent.setup();
    render(
      <DiffModal diff={searchDiff} title="test.ts" onClose={() => {}} />
    );

    fireEvent.keyDown(document, { key: "f", metaKey: true });
    const input = screen.getByPlaceholderText("Find...");
    await user.type(input, "bar");

    expect(screen.getByText("1 of 2")).toBeInTheDocument();

    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(screen.getByText("2 of 2")).toBeInTheDocument();
  });

  it("search works in side-by-side view", async () => {
    const user = userEvent.setup();
    render(
      <DiffModal diff={searchDiff} title="test.ts" onClose={() => {}} />
    );

    // Switch to side-by-side
    await user.click(screen.getByText("Side by side"));

    fireEvent.keyDown(document, { key: "f", metaKey: true });
    const input = screen.getByPlaceholderText("Find...");
    await user.type(input, "const");

    // Should still find matches
    expect(screen.getByText(/of \d+/)).toBeInTheDocument();
  });

  it("resets current match index when query changes", async () => {
    const user = userEvent.setup();
    render(
      <DiffModal diff={searchDiff} title="test.ts" onClose={() => {}} />
    );

    fireEvent.keyDown(document, { key: "f", metaKey: true });
    const input = screen.getByPlaceholderText("Find...");
    await user.type(input, "const");

    // Navigate to match 2
    await user.keyboard("{Enter}");
    expect(screen.getByText("2 of 4")).toBeInTheDocument();

    // Clear and type new query
    await user.clear(input);
    await user.type(input, "bar");

    // Should reset to match 1
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
  });
});

// Mock CurrentFileView for DiffModal "current" mode tests
vi.mock("./CurrentFileView", () => ({
  CurrentFileView: ({ filePath }: { filePath: string }) => (
    <div data-testid="current-file-view">{filePath}</div>
  ),
}));

describe("DiffModal current view mode", () => {
  it("renders a Current button in the mode toggle", () => {
    render(
      <DiffModal diff={hunkDiff} title="test.ts" onClose={() => {}} />
    );

    expect(screen.getByText("Current")).toBeInTheDocument();
  });

  it("switches to CurrentFileView when Current is clicked", async () => {
    const user = userEvent.setup();
    render(
      <DiffModal diff={hunkDiff} title="test.ts" onClose={() => {}} />
    );

    await user.click(screen.getByText("Current"));

    expect(screen.getByTestId("current-file-view")).toBeInTheDocument();
    expect(screen.getByTestId("current-file-view").textContent).toBe("test.ts");
  });

  it("does not render inline or side-by-side when in current mode", async () => {
    const user = userEvent.setup();
    const { baseElement } = render(
      <DiffModal diff={hunkDiff} title="test.ts" onClose={() => {}} />
    );

    await user.click(screen.getByText("Current"));

    // Pre element (used by InlineView/SideBySideView) should not be present
    const preElements = baseElement.querySelectorAll("pre");
    expect(preElements.length).toBe(0);
  });
});
