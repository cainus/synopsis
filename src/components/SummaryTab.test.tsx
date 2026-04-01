import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("shows generate button when repo is picked but summary not started", () => {
    render(<SummaryTab result={null} {...defaultProps} />);
    expect(screen.getByRole("button", { name: /generate summary/i })).toBeInTheDocument();
  });

  it("calls onGenerate when the button is clicked", async () => {
    const onGenerate = vi.fn();
    render(<SummaryTab result={null} {...defaultProps} onGenerate={onGenerate} />);
    await userEvent.click(screen.getByRole("button", { name: /generate summary/i }));
    expect(onGenerate).toHaveBeenCalledOnce();
  });

  it("shows spinner while loading", () => {
    render(<SummaryTab result={null} {...defaultProps} loading={true} />);
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
    // No bullet list rendered when bullets array is empty
    expect(document.querySelector("ul")).not.toBeInTheDocument();
  });
});
