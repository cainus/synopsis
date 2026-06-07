import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { DefinitionPeek } from "./DefinitionPeek";
import type { DefinitionResult } from "../types";

// Mock Shiki highlighter — return simple tokens so HighlightedLine renders clickable identifiers
vi.mock("@/hooks/useHighlighter", () => ({
  useHighlighter: (lines: string[]) =>
    lines.map((line: string) => [{ content: line, color: "#ccc" }]),
}));

// Mock langFromPath
vi.mock("@/lib/highlight", () => ({
  langFromPath: (path: string) => {
    if (path.endsWith(".ts")) return "typescript";
    if (path.endsWith(".rs")) return "rust";
    return null;
  },
}));

// Mock RepoContext
vi.mock("@/contexts/RepoContext", () => ({
  useRepoPath: () => "/fake/repo",
}));

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

const singleResult: DefinitionResult = {
  file: "src/service.ts",
  line_number: 42,
  line_content: "  async getMtc(id: string) {",
  context_before: ["class MyService {", "  private db: Database;", ""],
  context_after: ["    return this.db.find(id);", "  }", ""],
};

const secondResult: DefinitionResult = {
  file: "src/database.ts",
  line_number: 10,
  line_content: "export class Database {",
  context_before: ["// Database module", ""],
  context_after: ["  private pool: Pool;", ""],
};

const thirdResult: DefinitionResult = {
  file: "src/pool.ts",
  line_number: 5,
  line_content: "export class Pool {",
  context_before: ["// Pool module", ""],
  context_after: ["  private size: number;", ""],
};

// Mock clipboard API
const writeTextMock = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: writeTextMock },
  writable: true,
  configurable: true,
});

describe("DefinitionPeek", () => {
  beforeEach(() => {
    writeTextMock.mockClear();
    mockInvoke.mockReset();
  });

  it("shows loading spinner initially", () => {
    mockInvoke.mockReturnValue(new Promise(() => {})); // never resolves
    render(<DefinitionPeek symbol="getMtc" filePath="src/app.ts" onClose={() => {}} />);
    expect(screen.getByText("Looking up definition...")).toBeTruthy();
  });

  it("shows definition when one result is found", async () => {
    mockInvoke.mockResolvedValueOnce([singleResult]);
    render(<DefinitionPeek symbol="getMtc" filePath="src/app.ts" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("src/service.ts:42")).toBeTruthy();
    });
  });

  it("shows 'No definitions found' when zero results", async () => {
    mockInvoke.mockResolvedValueOnce([]);
    render(<DefinitionPeek symbol="unknown" filePath="src/app.ts" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("No definitions found")).toBeTruthy();
    });
  });

  it("shows list when multiple results are found", async () => {
    mockInvoke.mockResolvedValueOnce([singleResult, secondResult]);
    render(<DefinitionPeek symbol="getMtc" filePath="src/app.ts" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("src/service.ts:42")).toBeTruthy();
      expect(screen.getByText("src/database.ts:10")).toBeTruthy();
    });
  });

  it("navigates to a result when clicking it in the multi-result list", async () => {
    mockInvoke.mockResolvedValueOnce([singleResult, secondResult]);
    render(<DefinitionPeek symbol="getMtc" filePath="src/app.ts" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("src/service.ts:42")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("src/service.ts:42"));

    await waitFor(() => {
      // Should show the code view with context
      expect(screen.getByText("MyService")).toBeTruthy();
    });
  });

  it("calls onClose when close button is clicked", async () => {
    mockInvoke.mockResolvedValueOnce([singleResult]);
    const onClose = vi.fn();
    render(<DefinitionPeek symbol="getMtc" filePath="src/app.ts" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText("src/service.ts:42")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /close peek/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("copies file:line to clipboard when copy button is clicked", async () => {
    mockInvoke.mockResolvedValueOnce([singleResult]);
    render(<DefinitionPeek symbol="getMtc" filePath="src/app.ts" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("src/service.ts:42")).toBeTruthy();
    });

    const copyButton = screen.getByRole("button", { name: /copy path/i });
    fireEvent.click(copyButton);

    expect(writeTextMock).toHaveBeenCalledWith("src/service.ts:42");
  });

  it("shows a check icon after copying (feedback state)", async () => {
    vi.useFakeTimers();
    mockInvoke.mockResolvedValueOnce([singleResult]);
    render(<DefinitionPeek symbol="getMtc" filePath="src/app.ts" onClose={() => {}} />);

    await act(async () => {
      await Promise.resolve();
    });

    const copyButton = screen.getByRole("button", { name: /copy path/i });
    fireEvent.click(copyButton);

    expect(screen.getByRole("button", { name: /copied/i })).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByRole("button", { name: /copy path/i })).toBeTruthy();

    vi.useRealTimers();
  });

  describe("in-place navigation", () => {
    it("navigates in-place when clicking an identifier that has exactly one result", async () => {
      mockInvoke.mockResolvedValueOnce([singleResult]);
      render(<DefinitionPeek symbol="getMtc" filePath="src/app.ts" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText("src/service.ts:42")).toBeTruthy();
      });

      // Click on "Database" identifier in context
      mockInvoke.mockResolvedValueOnce([secondResult]);
      fireEvent.click(screen.getByText("Database"));

      expect(mockInvoke).toHaveBeenCalledWith("find_symbol_definition", {
        repoPath: "/fake/repo",
        symbol: "Database",
        languageHint: "typescript",
      });

      await waitFor(() => {
        expect(screen.getByText("src/database.ts:10")).toBeTruthy();
      });
    });

    it("shows back button after navigating and goes back when clicked", async () => {
      mockInvoke.mockResolvedValueOnce([singleResult]);
      render(<DefinitionPeek symbol="getMtc" filePath="src/app.ts" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText("src/service.ts:42")).toBeTruthy();
      });

      // Initially no back button
      expect(screen.queryByRole("button", { name: /back/i })).toBeNull();

      // Navigate to Database
      mockInvoke.mockResolvedValueOnce([secondResult]);
      fireEvent.click(screen.getByText("Database"));
      await waitFor(() => {
        expect(screen.getByText("src/database.ts:10")).toBeTruthy();
      });

      // Back button should now appear
      const backButton = screen.getByRole("button", { name: /back/i });
      expect(backButton).toBeTruthy();

      // Click back
      fireEvent.click(backButton);
      expect(screen.getByText("src/service.ts:42")).toBeTruthy();
    });

    it("shows multiple results as a list when lookup returns more than one", async () => {
      mockInvoke.mockResolvedValueOnce([singleResult]);
      render(<DefinitionPeek symbol="getMtc" filePath="src/app.ts" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText("src/service.ts:42")).toBeTruthy();
      });

      mockInvoke.mockResolvedValueOnce([secondResult, thirdResult]);
      fireEvent.click(screen.getByText("Database"));

      await waitFor(() => {
        expect(screen.getByText("src/database.ts:10")).toBeTruthy();
        expect(screen.getByText("src/pool.ts:5")).toBeTruthy();
      });
    });

    it("shows 'No definitions found' briefly when lookup returns zero results", async () => {
      vi.useFakeTimers();
      mockInvoke.mockResolvedValueOnce([singleResult]);
      render(<DefinitionPeek symbol="getMtc" filePath="src/app.ts" onClose={() => {}} />);

      await act(async () => {
        await Promise.resolve();
      });

      mockInvoke.mockImplementationOnce(() => Promise.resolve([]));
      await act(async () => {
        fireEvent.click(screen.getByText("Database"));
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByText("No definitions found")).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.queryByText("No definitions found")).toBeNull();

      vi.useRealTimers();
    });

    it("supports multi-level navigation with history stack", async () => {
      mockInvoke.mockResolvedValueOnce([singleResult]);
      render(<DefinitionPeek symbol="getMtc" filePath="src/app.ts" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText("src/service.ts:42")).toBeTruthy();
      });

      // Navigate to Database
      mockInvoke.mockResolvedValueOnce([secondResult]);
      fireEvent.click(screen.getByText("Database"));
      await waitFor(() => {
        expect(screen.getByText("src/database.ts:10")).toBeTruthy();
      });

      // Navigate to Pool
      mockInvoke.mockResolvedValueOnce([thirdResult]);
      fireEvent.click(screen.getByText("Pool"));
      await waitFor(() => {
        expect(screen.getByText("src/pool.ts:5")).toBeTruthy();
      });

      // Go back to Database
      fireEvent.click(screen.getByRole("button", { name: /back/i }));
      expect(screen.getByText("src/database.ts:10")).toBeTruthy();

      // Go back to original
      fireEvent.click(screen.getByRole("button", { name: /back/i }));
      expect(screen.getByText("src/service.ts:42")).toBeTruthy();
    });

    it("copies the CURRENT definition path, not the original", async () => {
      mockInvoke.mockResolvedValueOnce([singleResult]);
      render(<DefinitionPeek symbol="getMtc" filePath="src/app.ts" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText("src/service.ts:42")).toBeTruthy();
      });

      mockInvoke.mockResolvedValueOnce([secondResult]);
      fireEvent.click(screen.getByText("Database"));
      await waitFor(() => {
        expect(screen.getByText("src/database.ts:10")).toBeTruthy();
      });

      const copyButton = screen.getByRole("button", { name: /copy path/i });
      fireEvent.click(copyButton);

      expect(writeTextMock).toHaveBeenCalledWith("src/database.ts:10");
    });

    it("shows loading spinner while looking up a symbol", async () => {
      mockInvoke.mockResolvedValueOnce([singleResult]);
      render(<DefinitionPeek symbol="getMtc" filePath="src/app.ts" onClose={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText("src/service.ts:42")).toBeTruthy();
      });

      let resolveInvoke: (value: DefinitionResult[]) => void;
      mockInvoke.mockReturnValueOnce(
        new Promise<DefinitionResult[]>((resolve) => {
          resolveInvoke = resolve;
        })
      );

      fireEvent.click(screen.getByText("Database"));
      expect(screen.getByText("Looking up definition...")).toBeTruthy();

      await act(async () => {
        resolveInvoke!([secondResult]);
      });

      expect(screen.queryByText("Looking up definition...")).toBeNull();
    });
  });

  it("renders identifiers in source code as clickable (cursor-pointer)", async () => {
    mockInvoke.mockResolvedValueOnce([singleResult]);
    render(<DefinitionPeek symbol="getMtc" filePath="src/app.ts" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("src/service.ts:42")).toBeTruthy();
    });

    // "MyService" is an identifier in "class MyService {" — should be clickable
    const identifier = screen.getByText("MyService");
    expect(identifier.className).toContain("cursor-pointer");
  });
});
