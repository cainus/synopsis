import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CurrentFileView } from "./CurrentFileView";

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Mock useHighlighter
vi.mock("@/hooks/useHighlighter", () => ({
  useHighlighter: () => null,
}));

// Mock RepoContext
vi.mock("@/contexts/RepoContext", () => ({
  useRepoPath: () => "/fake/repo",
}));

beforeEach(() => {
  mockInvoke.mockReset();
});

describe("CurrentFileView", () => {
  it("shows loading spinner while fetching", () => {
    // invoke never resolves
    mockInvoke.mockReturnValue(new Promise(() => {}));

    render(<CurrentFileView filePath="src/App.tsx" />);

    expect(screen.getByText("Loading file...")).toBeInTheDocument();
  });

  it("renders file content with line numbers after loading", async () => {
    mockInvoke.mockResolvedValue("const x = 1;\nconst y = 2;\n");

    const { container } = render(<CurrentFileView filePath="src/App.tsx" />);

    // Wait for content to load
    await screen.findByText(/const x = 1/);

    // Should have line numbers
    expect(container.textContent).toContain("1");
    expect(container.textContent).toContain("2");
    expect(container.textContent).toContain("const x = 1;");
    expect(container.textContent).toContain("const y = 2;");
  });

  it("shows error message when file is not found", async () => {
    mockInvoke.mockRejectedValue("Failed to read file: No such file or directory");

    render(<CurrentFileView filePath="deleted.txt" />);

    await screen.findByText("File not found");
  });

  it("calls invoke with correct arguments", async () => {
    mockInvoke.mockResolvedValue("hello");

    render(<CurrentFileView filePath="src/main.ts" />);

    await screen.findByText("hello");

    expect(mockInvoke).toHaveBeenCalledWith("get_file_content", {
      repoPath: "/fake/repo",
      file: "src/main.ts",
    });
  });

  it("highlights search matches when searchQuery is provided", async () => {
    mockInvoke.mockResolvedValue("foo bar\nbaz\nfoo again\n");

    const onMatchCount = vi.fn();
    const { container } = render(
      <CurrentFileView
        filePath="test.ts"
        searchQuery="foo"
        currentMatchIndex={0}
        onMatchCount={onMatchCount}
      />
    );

    await screen.findByText(/foo bar/);

    // Should report 2 matches
    expect(onMatchCount).toHaveBeenCalledWith(2);

    // First match should have current highlight
    const highlighted = container.querySelectorAll(".bg-yellow-500\\/40");
    expect(highlighted.length).toBe(1);
  });
});
