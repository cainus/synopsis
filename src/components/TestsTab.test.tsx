import { render, screen } from "@testing-library/react";
import { TestsTab } from "./TestsTab";
import type { TestsResult } from "../types";

const result: TestsResult = {
  test_cases: [
    {
      full_name: "UserService > login > handles invalid password",
      file: "src/services/UserService.test.ts",
      behaviour_change: "Now throws an error instead of returning null",
    },
    {
      full_name: "formatDate > formats ISO strings",
      file: "src/services/UserService.test.ts",
      behaviour_change: "No behaviour change",
    },
    {
      full_name: "renders correctly",
      file: "src/components/Button.test.tsx",
      behaviour_change: "New test",
    },
  ],
};

describe("TestsTab", () => {
  it("shows empty state before a repo is picked", () => {
    render(<TestsTab result={null} loading={false} hasRepo={false} />);
    expect(screen.getByText(/pick a repo folder/i)).toBeInTheDocument();
  });

  it("shows spinner while Claude analyses", () => {
    render(<TestsTab result={null} loading={true} hasRepo={true} />);
    expect(screen.getByText(/claude is thinking/i)).toBeInTheDocument();
    expect(document.querySelector(".spinner")).toBeInTheDocument();
  });

  it("shows empty state when no test files changed", () => {
    render(
      <TestsTab
        result={{ test_cases: [] }}
        loading={false}
        hasRepo={true}
      />
    );
    expect(screen.getByText(/no test file changes/i)).toBeInTheDocument();
  });

  it("renders the full test name for each case", () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    expect(
      screen.getByText("UserService > login > handles invalid password")
    ).toBeInTheDocument();
    expect(
      screen.getByText("formatDate > formats ISO strings")
    ).toBeInTheDocument();
  });

  it("renders behaviour change descriptions", () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    expect(
      screen.getByText("Now throws an error instead of returning null")
    ).toBeInTheDocument();
  });

  it("applies no-change class to 'No behaviour change' entries", () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    const noChange = screen.getByText("No behaviour change");
    expect(noChange).toHaveClass("no-change");
  });

  it("does not apply no-change class to actual behaviour changes", () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    const change = screen.getByText(
      "Now throws an error instead of returning null"
    );
    expect(change).not.toHaveClass("no-change");
  });

  it("applies new-test class to 'New test' entries", () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    const newTest = screen.getByText("New test");
    expect(newTest).toHaveClass("new-test");
  });

  it("renders a file header for each distinct file", () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    expect(screen.getByText("src/services/UserService.test.ts")).toBeInTheDocument();
    expect(screen.getByText("src/components/Button.test.tsx")).toBeInTheDocument();
  });

  it("groups tests under their file header", () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    const groups = document.querySelectorAll(".tests-file-group");
    expect(groups).toHaveLength(2);
  });
});
