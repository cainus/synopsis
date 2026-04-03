import { render, screen } from "@testing-library/react";
import { SummaryTab } from "./SummaryTab";
import type { SummaryResult } from "../types";

const mockResult: SummaryResult = {
  headline: "Refactored auth module to use JWT tokens",
  bullets: [
    { label: "Auth", text: "Replaced session-based auth with JWT tokens across all endpoints" },
    { label: "Middleware", text: "New jwtAuth middleware validates and decodes tokens on each request" },
    { label: "Dependencies", text: "Removed connect-redis and express-session packages" },
  ],
};

const defaultProps = {
  loading: false,
  hasRepo: true,
  onGenerate: vi.fn(),
};

describe("SummaryTab", () => {
  it("shows empty state before a repo is picked", () => {
    render(<SummaryTab result={null} {...defaultProps} hasRepo={false} />);
    expect(screen.getByText(/pick a repo folder/i)).toBeInTheDocument();
  });

  it("auto-generates when repo is picked but no result yet", () => {
    const onGenerate = vi.fn();
    render(<SummaryTab result={null} {...defaultProps} onGenerate={onGenerate} />);
    expect(onGenerate).toHaveBeenCalledOnce();
  });

  it("shows spinner when no result yet", () => {
    render(<SummaryTab result={null} {...defaultProps} />);
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
  });

  it("renders headline", () => {
    render(<SummaryTab result={mockResult} {...defaultProps} />);
    expect(screen.getByText(mockResult.headline)).toBeInTheDocument();
  });

  it("renders bullet labels and text", () => {
    render(<SummaryTab result={mockResult} {...defaultProps} />);
    expect(screen.getByText("Auth")).toBeInTheDocument();
    expect(screen.getByText("Middleware")).toBeInTheDocument();
    expect(screen.getByText("Dependencies")).toBeInTheDocument();
    expect(screen.getByText(/Replaced session-based auth/)).toBeInTheDocument();
  });

  it("renders no bullets when empty", () => {
    const empty: SummaryResult = { headline: "No changes", bullets: [] };
    render(<SummaryTab result={empty} {...defaultProps} />);
    expect(screen.getByText("No changes")).toBeInTheDocument();
    expect(document.querySelector("ul")).not.toBeInTheDocument();
  });
});
