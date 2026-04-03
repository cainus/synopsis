import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DetailsTab } from "./DetailsTab";
import type { DetailsResult } from "../types";

const mockResult: DetailsResult = {
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
  loading: false,
  hasRepo: true,
  onGenerate: vi.fn(),
  repoPath: "/test/repo",
};

function getCollapsibleFor(buttonText: string) {
  const btn = screen.getByText(buttonText);
  return btn.closest('[data-slot="collapsible"]')!;
}

describe("DetailsTab", () => {
  it("shows empty state before a repo is picked", () => {
    render(<DetailsTab result={null} {...defaultProps} hasRepo={false} />);
    expect(screen.getByText(/pick a repo folder/i)).toBeInTheDocument();
  });

  it("auto-generates when repo is picked but no result yet", () => {
    const onGenerate = vi.fn();
    render(<DetailsTab result={null} {...defaultProps} onGenerate={onGenerate} />);
    expect(onGenerate).toHaveBeenCalledOnce();
  });

  it("shows spinner when no result yet", () => {
    render(<DetailsTab result={null} {...defaultProps} />);
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
  });

  it("renders section headings and top-level titles", () => {
    render(<DetailsTab result={mockResult} {...defaultProps} />);
    expect(screen.getByText("Product Changes")).toBeInTheDocument();
    expect(screen.getByText("Technical Changes")).toBeInTheDocument();
    expect(screen.getByText("Users now stay logged in longer")).toBeInTheDocument();
    expect(screen.getByText("Replaced session middleware with JWT middleware")).toBeInTheDocument();
  });

  it("top-level items start collapsed and expand on click", async () => {
    render(<DetailsTab result={mockResult} {...defaultProps} />);
    const collapsible = getCollapsibleFor("Users now stay logged in longer");
    expect(collapsible).toHaveAttribute("data-closed", "");

    await userEvent.click(screen.getByText("Users now stay logged in longer"));
    expect(collapsible).toHaveAttribute("data-open", "");

    await userEvent.click(screen.getByText("Users now stay logged in longer"));
    expect(collapsible).toHaveAttribute("data-closed", "");
  });

  it("only one top-level item open at a time across sections", async () => {
    render(<DetailsTab result={mockResult} {...defaultProps} />);
    const productCollapsible = getCollapsibleFor("Users now stay logged in longer");
    const techCollapsible = getCollapsibleFor("Replaced session middleware with JWT middleware");

    await userEvent.click(screen.getByText("Users now stay logged in longer"));
    expect(productCollapsible).toHaveAttribute("data-open", "");

    await userEvent.click(screen.getByText("Replaced session middleware with JWT middleware"));
    expect(productCollapsible).toHaveAttribute("data-closed", "");
    expect(techCollapsible).toHaveAttribute("data-open", "");
  });

  it("nested nodes with children are independently collapsible", async () => {
    render(<DetailsTab result={mockResult} {...defaultProps} />);
    await userEvent.click(screen.getByText("Replaced session middleware with JWT middleware"));

    const nestedCollapsible = getCollapsibleFor("New jwtAuth middleware validates tokens on each request");
    expect(nestedCollapsible).toHaveAttribute("data-closed", "");

    await userEvent.click(screen.getByText("New jwtAuth middleware validates tokens on each request"));
    expect(nestedCollapsible).toHaveAttribute("data-open", "");
  });

  it("shows code icon button for items with files", () => {
    render(<DetailsTab result={mockResult} {...defaultProps} />);
    const codeButtons = screen.getAllByTitle("View code changes");
    expect(codeButtons.length).toBeGreaterThan(0);
  });

  it("does not show code icon for items without files", () => {
    render(<DetailsTab result={mockResult} {...defaultProps} />);
    // "Users now stay logged in longer" has files: [] — should not have a code button
    const title = screen.getByText("Users now stay logged in longer");
    const listItem = title.closest("li")!;
    expect(listItem.querySelector('[title="View code changes"]')).toBeNull();
  });

  it("opens diff modal with all file snippets when code button is clicked", async () => {
    render(<DetailsTab result={mockResult} {...defaultProps} />);
    // "Added token refresh endpoint" has files directly
    const codeButtons = screen.getAllByTitle("View code changes");
    await userEvent.click(codeButtons[codeButtons.length - 1]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("modal shows grouped snippets from multiple files", async () => {
    const multiFileResult: DetailsResult = {
      product_changes: [],
      technical_changes: [
        {
          title: "Refactored auth across multiple files",
          files: [
            { file: "src/auth.ts", snippet: "@@ -1,3 +1,5 @@\n+export const auth = () => {};" },
            { file: "src/middleware.ts", snippet: "@@ -1,2 +1,3 @@\n+export const middleware = () => {};" },
          ],
          children: [],
        },
      ],
    };
    render(<DetailsTab result={multiFileResult} {...defaultProps} />);
    await userEvent.click(screen.getByText("Refactored auth across multiple files"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // Both file snippets should appear in the combined output
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("export const auth");
    expect(dialog.textContent).toContain("export const middleware");
  });

  it("hides section when there are no items", () => {
    const noProduct: DetailsResult = { ...mockResult, product_changes: [] };
    render(<DetailsTab result={noProduct} {...defaultProps} />);
    expect(screen.queryByText("Product Changes")).not.toBeInTheDocument();
    expect(screen.getByText("Technical Changes")).toBeInTheDocument();
  });
});
