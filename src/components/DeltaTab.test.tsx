import { render, screen } from "@testing-library/react";
import { DeltaTab } from "./DeltaTab";
import { RepoProvider } from "@/contexts/RepoContext";
import type { DeltaResult } from "../types";

const result: DeltaResult = {
  default_branch: "main",
  current_branch: "feature/foo",
  files: [
    { path: "src/app.ts", added: 7, removed: 3, untracked: false, status: "modified" as const },
    { path: "src/utils.ts", added: 4, removed: 5, untracked: false, status: "modified" as const },
  ],
};

function renderWithRepo(ui: React.ReactElement, repoPath: string | null = "/test") {
  return render(<RepoProvider value={repoPath}>{ui}</RepoProvider>);
}

describe("DeltaTab", () => {
  it("shows loading message while fetching", () => {
    renderWithRepo(<DeltaTab result={null} loading={true} />);
    expect(screen.getByText(/loading diff/i)).toBeInTheDocument();
  });

  it("shows empty state before a repo is picked", () => {
    renderWithRepo(<DeltaTab result={null} loading={false} />);
    expect(screen.getByText(/pick a repo folder/i)).toBeInTheDocument();
  });

  it("shows empty state when there are no changed files", () => {
    renderWithRepo(
      <DeltaTab
        result={{ default_branch: "main", current_branch: "feature/foo", files: [] }}
        loading={false}
      />
    );
    expect(screen.getByText(/no changes vs/i)).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
  });

  it("renders the branch name", () => {
    renderWithRepo(<DeltaTab result={result} loading={false} />);
    expect(screen.getByText("main")).toBeInTheDocument();
  });

  it("renders each changed file path", () => {
    renderWithRepo(<DeltaTab result={result} loading={false} />);
    expect(screen.getByText("src/app.ts")).toBeInTheDocument();
    expect(screen.getByText("src/utils.ts")).toBeInTheDocument();
  });

  it("renders added lines in green with + prefix", () => {
    renderWithRepo(<DeltaTab result={result} loading={false} />);
    const added = screen.getAllByText(/^\+\d+/);
    expect(added.length).toBeGreaterThan(0);
    added.forEach((el) => expect(el.className).toContain("text-green-500"));
  });

  it("renders removed lines in red with - prefix", () => {
    renderWithRepo(<DeltaTab result={result} loading={false} />);
    const removed = screen.getAllByText(/^-\d+/);
    expect(removed.length).toBeGreaterThan(0);
    removed.forEach((el) => expect(el.className).toContain("text-red-400"));
  });

  it("renders correct totals in the footer", () => {
    renderWithRepo(<DeltaTab result={result} loading={false} />);
    // total added = 7+4 = 11, total removed = 3+5 = 8 (neither matches any individual file)
    expect(screen.getByText("+11")).toBeInTheDocument();
    expect(screen.getByText("-8")).toBeInTheDocument();
    expect(screen.getByText(/2 files/)).toBeInTheDocument();
  });
});
