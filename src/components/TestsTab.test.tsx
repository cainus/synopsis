import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestsTab } from "./TestsTab";
import type { TestsResult } from "../types";

const result: TestsResult = {
  test_cases: [
    {
      full_name: "UserService > login > handles invalid password",
      file: "src/services/UserService.test.ts",
      behaviour_change: "Now throws an error instead of returning null",
      snippet: "@@ -10,3 +10,5 @@\n-expect(result).toBeNull();\n+expect(() => login()).toThrow();",
    },
    {
      full_name: "formatDate > formats ISO strings",
      file: "src/services/UserService.test.ts",
      behaviour_change: "No behaviour change",
      snippet: "@@ -20,2 +20,2 @@\n-const fmt = formatDate(d);\n+const fmt = formatDate(d, 'iso');",
    },
    {
      full_name: "renders correctly",
      file: "src/components/Button.test.tsx",
      behaviour_change: "New test",
      snippet: "+it('renders correctly', () => {\n+  render(<Button />);\n+});",
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
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
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

  it("renders the test name (leaf) for each case", () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    // Tree splits by " > " — only the leaf name is in test-name
    expect(screen.getByText("handles invalid password")).toBeInTheDocument();
    expect(screen.getByText("formats ISO strings")).toBeInTheDocument();
    // Describe segments are rendered as headers
    expect(screen.getByText("UserService")).toBeInTheDocument();
    expect(screen.getByText("login")).toBeInTheDocument();
  });

  it("renders behaviour change descriptions", () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    expect(
      screen.getByText("Now throws an error instead of returning null")
    ).toBeInTheDocument();
  });

  it("applies unchanged class to 'No behaviour change' entries", () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    const noChange = screen.getByText("No behaviour change");
    expect(noChange).toHaveClass("test-behaviour-unchanged");
  });

  it("applies modified class to behaviour changes", () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    const change = screen.getByText(
      "Now throws an error instead of returning null"
    );
    expect(change).toHaveClass("test-behaviour-modified");
  });

  it("does not render 'New test' label for added tests", () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    expect(screen.queryByText("New test")).not.toBeInTheDocument();
  });

  it("shows + icon for new tests", () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    const icons = document.querySelectorAll(".test-icon-added");
    expect(icons.length).toBeGreaterThan(0);
    expect(icons[0].textContent).toBe("+");
  });

  it("shows Δ icon for modified tests", () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    const icons = document.querySelectorAll(".test-icon-modified");
    expect(icons.length).toBeGreaterThan(0);
    expect(icons[0].textContent).toBe("Δ");
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

  it("file groups start collapsed", () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    const bodies = document.querySelectorAll(".tests-file-body");
    bodies.forEach((b) => expect(b).not.toHaveClass("open"));
  });

  it("expands a file group on click and collapses others", async () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    const headers = screen.getAllByRole("button");
    const firstBody = headers[0].closest(".tests-file-group")!.querySelector(".tests-file-body")!;
    const secondBody = headers[1].closest(".tests-file-group")!.querySelector(".tests-file-body")!;

    await userEvent.click(headers[0]);
    expect(firstBody).toHaveClass("open");

    await userEvent.click(headers[1]);
    expect(firstBody).not.toHaveClass("open");
    expect(secondBody).toHaveClass("open");
  });

  it("opens diff modal when a test case is clicked", async () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    // Expand first file group
    const headers = screen.getAllByRole("button");
    await userEvent.click(headers[0]);

    // Click on modified test
    const testCase = screen.getByText("handles invalid password").closest(".test-case")!;
    await userEvent.click(testCase);

    expect(document.querySelector(".diff-modal")).toBeInTheDocument();
    // Modal title should contain file and test name
    expect(document.querySelector(".diff-modal-title")!.textContent).toContain("handles invalid password");
  });

  it("closes diff modal on close button", async () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    const headers = screen.getAllByRole("button");
    await userEvent.click(headers[0]);

    const testCase = screen.getByText("handles invalid password").closest(".test-case")!;
    await userEvent.click(testCase);
    expect(document.querySelector(".diff-modal")).toBeInTheDocument();

    await userEvent.click(screen.getByText("✕"));
    expect(document.querySelector(".diff-modal")).not.toBeInTheDocument();
  });
});
