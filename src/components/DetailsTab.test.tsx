import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DetailsTab } from "./DetailsTab";
import type { DetailsResult } from "../types";

const mockResult: DetailsResult = {
  product_changes: [
    {
      title: "Users now stay logged in longer",
      file: "",
      snippet: "",
      children: [
        { title: "JWT refresh tokens extend sessions automatically", file: "src/auth.ts", snippet: "@@ -10,3 +10,5 @@\n+const refreshToken = jwt.sign(payload, secret);", children: [] },
        { title: "No more forced re-login after 30 minutes", file: "", snippet: "", children: [] },
      ],
    },
  ],
  technical_changes: [
    {
      title: "Replaced session middleware with JWT middleware",
      file: "",
      snippet: "",
      children: [
        { title: "Removed express-session dependency", file: "package.json", snippet: "@@ -12,3 +12,2 @@\n-    \"connect-redis\": \"^6.1.0\",", children: [] },
        {
          title: "New jwtAuth middleware validates tokens on each request",
          file: "src/middleware/auth.ts",
          snippet: "@@ -1,5 +1,8 @@\n-const session = require('express-session');\n+const { verify } = require('jsonwebtoken');",
          children: [
            { title: "Checks token expiry and signature", file: "src/middleware/auth.ts", snippet: "+  if (decoded.exp < Date.now()) throw new Error('expired');", children: [] },
          ],
        },
      ],
    },
    {
      title: "Added token refresh endpoint",
      file: "src/routes/auth.ts",
      snippet: "@@ -0,0 +1,10 @@\n+router.post('/refresh', ...)",
      children: [
        { title: "POST /auth/refresh returns new access token", file: "src/routes/auth.ts", snippet: "+router.post('/refresh', ...)", children: [] },
      ],
    },
  ],
};

const defaultProps = {
  loading: false,
  hasRepo: true,
  onGenerate: vi.fn(),
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

  it("shows generate button when not yet fetched", () => {
    render(<DetailsTab result={null} {...defaultProps} />);
    expect(screen.getByRole("button", { name: /generate details/i })).toBeInTheDocument();
  });

  it("calls onGenerate when the button is clicked", async () => {
    const onGenerate = vi.fn();
    render(<DetailsTab result={null} {...defaultProps} onGenerate={onGenerate} />);
    await userEvent.click(screen.getByRole("button", { name: /generate details/i }));
    expect(onGenerate).toHaveBeenCalledOnce();
  });

  it("shows spinner while loading", () => {
    render(<DetailsTab result={null} {...defaultProps} loading={true} />);
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

  it("renders snippet links for items with a file", () => {
    render(<DetailsTab result={mockResult} {...defaultProps} />);
    const fileLinks = screen.getAllByText("auth.ts");
    expect(fileLinks.length).toBeGreaterThan(0);
    expect(fileLinks[0].className).toContain("font-mono");
  });

  it("opens diff modal when snippet link is clicked", async () => {
    render(<DetailsTab result={mockResult} {...defaultProps} />);
    const authLink = screen.getAllByText("auth.ts")[0];
    await userEvent.click(authLink);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("hides section when there are no items", () => {
    const noProduct: DetailsResult = { ...mockResult, product_changes: [] };
    render(<DetailsTab result={noProduct} {...defaultProps} />);
    expect(screen.queryByText("Product Changes")).not.toBeInTheDocument();
    expect(screen.getByText("Technical Changes")).toBeInTheDocument();
  });
});
