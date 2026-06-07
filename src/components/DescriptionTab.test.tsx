import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DescriptionTab } from "./DescriptionTab";
import { RepoProvider } from "@/contexts/RepoContext";
import type { DetailsResult, SummaryResult } from "../types";

const mockSummary: SummaryResult = {
  headline: "Refactored auth module to use JWT tokens",
  has_application_code_changes: true,
  has_test_changes: true,
  is_pure_refactor: false,
  bullets: [
    { label: "Auth", text: "Replaced session-based auth with JWT tokens across all endpoints" },
    { label: "Tests", text: "Added coverage for token refresh behavior" },
  ],
};

const mockDetails: DetailsResult = {
  product_changes: [
    {
      title: "Users now stay logged in longer",
      files: [],
      children: [
        { title: "JWT refresh tokens extend sessions automatically", files: [{ file: "src/auth.ts", snippet: "@@ -10,3 +10,5 @@\n+const refreshToken = jwt.sign(payload, secret);" }], children: [] },
        { title: "No more forced re-login after 30 minutes", files: [], children: [] },
      ],
    },
  ],
  technical_changes: [
    {
      title: "Replaced session middleware with JWT middleware",
      files: [],
      children: [
        { title: "Removed express-session dependency", files: [{ file: "package.json", snippet: "@@ -12,3 +12,2 @@\n-    \"connect-redis\": \"^6.1.0\"," }], children: [] },
        {
          title: "New jwtAuth middleware validates tokens on each request",
          files: [{ file: "src/middleware/auth.ts", snippet: "@@ -1,5 +1,8 @@\n-const session = require('express-session');\n+const { verify } = require('jsonwebtoken');" }],
          children: [
            { title: "Checks token expiry and signature", files: [{ file: "src/middleware/auth.ts", snippet: "+  if (decoded.exp < Date.now()) throw new Error('expired');" }], children: [] },
          ],
        },
      ],
    },
    {
      title: "Added token refresh endpoint",
      files: [{ file: "src/routes/auth.ts", snippet: "@@ -0,0 +1,10 @@\n+router.post('/refresh', ...)" }],
      children: [
        { title: "POST /auth/refresh returns new access token", files: [{ file: "src/routes/auth.ts", snippet: "+router.post('/refresh', ...)" }], children: [] },
      ],
    },
  ],
};

const defaultProps = {
  summaryResult: mockSummary,
  detailsResult: mockDetails,
  summaryLoading: false,
  detailsLoading: false,
  hasRepo: true,
  onGenerate: vi.fn(),
};

function renderWithRepo(ui: React.ReactElement, repoPath: string | null = "/test/repo") {
  return render(<RepoProvider value={repoPath}>{ui}</RepoProvider>);
}

function getCollapsibleFor(buttonText: string) {
  const btn = screen.getByText(buttonText);
  return btn.closest('[data-slot="collapsible"]')!;
}

describe("DescriptionTab", () => {
  it("shows empty state before a repo is picked", () => {
    renderWithRepo(<DescriptionTab {...defaultProps} summaryResult={null} hasRepo={false} />);
    expect(screen.getByText(/pick a repo folder to generate a description/i)).toBeInTheDocument();
  });

  it("auto-generates when repo is picked but no summary result exists", () => {
    const onGenerate = vi.fn();
    renderWithRepo(<DescriptionTab {...defaultProps} summaryResult={null} onGenerate={onGenerate} />);
    expect(onGenerate).toHaveBeenCalledOnce();
  });

  it("shows spinner when no summary result exists", () => {
    renderWithRepo(<DescriptionTab {...defaultProps} summaryResult={null} />);
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
  });

  it("renders change status, summary, and details on one page", () => {
    renderWithRepo(<DescriptionTab {...defaultProps} />);
    expect(screen.getByText("Application code: Changed")).toBeInTheDocument();
    expect(screen.getByText("Tests: Changed")).toBeInTheDocument();
    expect(screen.getByText("Pure refactor: No")).toBeInTheDocument();
    expect(screen.getByText(mockSummary.headline)).toBeInTheDocument();
    expect(screen.getByText("Auth")).toBeInTheDocument();
    expect(screen.getByText("Product Changes")).toBeInTheDocument();
    expect(screen.getByText("Technical Changes")).toBeInTheDocument();
    expect(screen.getByText("Users now stay logged in longer")).toBeInTheDocument();
  });

  it("renders negative status values", () => {
    const summary: SummaryResult = {
      ...mockSummary,
      has_application_code_changes: false,
      has_test_changes: false,
      is_pure_refactor: true,
    };
    renderWithRepo(<DescriptionTab {...defaultProps} summaryResult={summary} />);
    expect(screen.getByText("Application code: No changes")).toBeInTheDocument();
    expect(screen.getByText("Tests: No changes")).toBeInTheDocument();
    expect(screen.getByText("Pure refactor: Yes")).toBeInTheDocument();
  });

  it("shows details loading below an available summary", () => {
    renderWithRepo(<DescriptionTab {...defaultProps} detailsResult={null} detailsLoading />);
    expect(screen.getByText(mockSummary.headline)).toBeInTheDocument();
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
  });

  it("top-level detail items start collapsed and expand on click", async () => {
    renderWithRepo(<DescriptionTab {...defaultProps} />);
    const collapsible = getCollapsibleFor("Users now stay logged in longer");
    expect(collapsible).toHaveAttribute("data-closed", "");

    await userEvent.click(screen.getByText("Users now stay logged in longer"));
    expect(collapsible).toHaveAttribute("data-open", "");
  });

  it("only one top-level detail item is open at a time", async () => {
    renderWithRepo(<DescriptionTab {...defaultProps} />);
    const productCollapsible = getCollapsibleFor("Users now stay logged in longer");
    const techCollapsible = getCollapsibleFor("Replaced session middleware with JWT middleware");

    await userEvent.click(screen.getByText("Users now stay logged in longer"));
    expect(productCollapsible).toHaveAttribute("data-open", "");

    await userEvent.click(screen.getByText("Replaced session middleware with JWT middleware"));
    expect(productCollapsible).toHaveAttribute("data-closed", "");
    expect(techCollapsible).toHaveAttribute("data-open", "");
  });

  it("nested detail nodes with children are independently collapsible", async () => {
    renderWithRepo(<DescriptionTab {...defaultProps} />);
    await userEvent.click(screen.getByText("Replaced session middleware with JWT middleware"));

    const nestedCollapsible = getCollapsibleFor("New jwtAuth middleware validates tokens on each request");
    expect(nestedCollapsible).toHaveAttribute("data-closed", "");

    await userEvent.click(screen.getByText("New jwtAuth middleware validates tokens on each request"));
    expect(nestedCollapsible).toHaveAttribute("data-open", "");
  });

  it("opens snippet modal when a detail code button is clicked", async () => {
    renderWithRepo(<DescriptionTab {...defaultProps} />);
    const codeButtons = screen.getAllByTitle("View code changes");
    await userEvent.click(codeButtons[codeButtons.length - 1]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("hides empty detail sections", () => {
    const noProduct: DetailsResult = { ...mockDetails, product_changes: [] };
    renderWithRepo(<DescriptionTab {...defaultProps} detailsResult={noProduct} />);
    expect(screen.queryByText("Product Changes")).not.toBeInTheDocument();
    expect(screen.getByText("Technical Changes")).toBeInTheDocument();
  });
});
