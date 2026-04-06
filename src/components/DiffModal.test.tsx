import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DiffModal } from "./DiffModal";

// Mock Shiki highlighter to avoid async loading
vi.mock("@/hooks/useHighlighter", () => ({
  useHighlighter: () => null,
}));

// Mock DefinitionPopover
vi.mock("./DefinitionPopover", () => ({
  DefinitionPopover: () => null,
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
