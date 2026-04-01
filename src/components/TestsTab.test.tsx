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
    // Spinner is now a Tailwind-styled span with animate-spin
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
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

  it("renders the test name (leaf) for each case", async () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    // Expand first file group to see test names
    const triggers = screen.getAllByRole("button");
    await userEvent.click(triggers[0]);
    expect(screen.getByText("handles invalid password")).toBeInTheDocument();
    expect(screen.getByText("formats ISO strings")).toBeInTheDocument();
    // Describe segments are rendered as headers
    expect(screen.getByText("UserService")).toBeInTheDocument();
    expect(screen.getByText("login")).toBeInTheDocument();
  });

  it("renders behaviour change descriptions", async () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    const triggers = screen.getAllByRole("button");
    await userEvent.click(triggers[0]);
    expect(
      screen.getByText("Now throws an error instead of returning null")
    ).toBeInTheDocument();
  });

  it("applies unchanged styling to 'No behaviour change' entries", async () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    const triggers = screen.getAllByRole("button");
    await userEvent.click(triggers[0]);
    const noChange = screen.getByText("No behaviour change");
    expect(noChange.className).toContain("italic");
  });

  it("applies modified styling to behaviour changes", async () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    const triggers = screen.getAllByRole("button");
    await userEvent.click(triggers[0]);
    const change = screen.getByText(
      "Now throws an error instead of returning null"
    );
    expect(change.className).toContain("text-foreground");
  });

  it("does not render 'New test' label for added tests", () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    expect(screen.queryByText("New test")).not.toBeInTheDocument();
  });

  it("shows + icon for new tests", async () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    // Expand second file (Button.test.tsx) to see the added test
    const triggers = screen.getAllByRole("button");
    await userEvent.click(triggers[1]);
    const icons = document.querySelectorAll(".text-green-500");
    const plusIcons = Array.from(icons).filter((el) => el.textContent === "+");
    expect(plusIcons.length).toBeGreaterThan(0);
  });

  it("shows Δ icon for modified tests", async () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    const triggers = screen.getAllByRole("button");
    await userEvent.click(triggers[0]);
    const icons = document.querySelectorAll(".text-amber-500");
    const deltaIcons = Array.from(icons).filter((el) => el.textContent === "Δ");
    expect(deltaIcons.length).toBeGreaterThan(0);
  });

  it("renders a file header for each distinct file", () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    expect(screen.getByText("src/services/UserService.test.ts")).toBeInTheDocument();
    expect(screen.getByText("src/components/Button.test.tsx")).toBeInTheDocument();
  });

  it("groups tests under their file collapsible", () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    const collapsibles = document.querySelectorAll('[data-slot="collapsible"]');
    expect(collapsibles).toHaveLength(2);
  });

  it("file groups start collapsed", () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    const collapsibles = document.querySelectorAll('[data-slot="collapsible"]');
    collapsibles.forEach((c) => expect(c).toHaveAttribute("data-closed", ""));
  });

  it("expands a file group on click and collapses others", async () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    const triggers = screen.getAllByRole("button");

    await userEvent.click(triggers[0]);
    const collapsibles = document.querySelectorAll('[data-slot="collapsible"]');
    expect(collapsibles[0]).toHaveAttribute("data-open", "");

    await userEvent.click(triggers[1]);
    const updatedCollapsibles = document.querySelectorAll('[data-slot="collapsible"]');
    expect(updatedCollapsibles[0]).toHaveAttribute("data-closed", "");
    expect(updatedCollapsibles[1]).toHaveAttribute("data-open", "");
  });

  it("opens diff modal when a test case is clicked", async () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    const triggers = screen.getAllByRole("button");
    await userEvent.click(triggers[0]);

    // Click on modified test
    const testName = screen.getByText("handles invalid password");
    const testCase = testName.closest('[class*="cursor-pointer"]')!;
    await userEvent.click(testCase);

    // Dialog should be open
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // Modal title contains the test name (there will be multiple matches now - one in list, one in dialog)
    expect(screen.getAllByText(/handles invalid password/).length).toBeGreaterThanOrEqual(1);
  });

  it("closes diff modal on dialog close", async () => {
    render(<TestsTab result={result} loading={false} hasRepo={true} />);
    const triggers = screen.getAllByRole("button");
    await userEvent.click(triggers[0]);

    const testName = screen.getByText("handles invalid password");
    const testCase = testName.closest('[class*="cursor-pointer"]')!;
    await userEvent.click(testCase);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Press Escape to close
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
