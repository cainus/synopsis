import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HighlightedLine } from "./HighlightedLine";

const mockTokens = [
  { content: "const", color: "#F97583", offset: 0 },
  { content: " ", color: "#E1E4E8", offset: 5 },
  { content: "foo", color: "#79B8FF", offset: 6 },
  { content: " = diffBg;", color: "#E1E4E8", offset: 9 },
];

describe("HighlightedLine", () => {
  it("renders plain text when tokens is null", () => {
    render(<HighlightedLine tokens={null} plainText="hello world" />);
    expect(screen.getByText("hello world")).toBeInTheDocument();
  });

  it("renders tokens with correct colors (style attribute)", () => {
    const { container } = render(
      <HighlightedLine tokens={mockTokens} plainText="const foo = diffBg;" />
    );
    const spans = container.querySelectorAll("span[style]");
    const coloredSpans = Array.from(spans).filter((s) => (s as HTMLElement).style.color);
    expect(coloredSpans.length).toBeGreaterThan(0);
    // "const" should have its color
    const constSpan = Array.from(coloredSpans).find((s) => s.textContent === "const");
    expect(constSpan).toBeTruthy();
    expect((constSpan as HTMLElement).style.color).toBe("rgb(249, 117, 131)");
  });

  it("makes identifiers clickable when onTokenClick is provided", async () => {
    const handleClick = vi.fn();
    render(
      <HighlightedLine tokens={mockTokens} plainText="const foo = diffBg;" onTokenClick={handleClick} />
    );
    // "foo" is a clickable identifier
    const fooSpan = screen.getByText("foo");
    expect(fooSpan.className).toContain("cursor-pointer");
    await userEvent.click(fooSpan);
    expect(handleClick).toHaveBeenCalledOnce();
    expect(handleClick).toHaveBeenCalledWith("foo", expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
  });

  it("does NOT make keywords clickable", () => {
    const handleClick = vi.fn();
    render(
      <HighlightedLine tokens={mockTokens} plainText="const foo = diffBg;" onTokenClick={handleClick} />
    );
    // "const" is a keyword and should NOT be clickable
    const constSpan = screen.getByText("const");
    expect(constSpan.className).not.toContain("cursor-pointer");
  });

  it("splits compound tokens — makes identifiers clickable but not punctuation", () => {
    const handleClick = vi.fn();
    // The token " = diffBg;" contains the identifier "diffBg" plus non-identifier chars
    render(
      <HighlightedLine tokens={mockTokens} plainText="const foo = diffBg;" onTokenClick={handleClick} />
    );
    const diffBgSpan = screen.getByText("diffBg");
    expect(diffBgSpan.className).toContain("cursor-pointer");
    // The semicolon should not be clickable
    const semiSpan = screen.getByText(";");
    expect(semiSpan.className).not.toContain("cursor-pointer");
  });

  it("does not render click handlers when onTokenClick is undefined", () => {
    const { container } = render(
      <HighlightedLine tokens={mockTokens} plainText="const foo = diffBg;" />
    );
    // No element should have cursor-pointer class
    const clickable = container.querySelectorAll(".cursor-pointer");
    expect(clickable).toHaveLength(0);
  });

  it("single-character identifiers are not clickable", () => {
    const handleClick = vi.fn();
    const singleCharTokens = [
      { content: "x", color: "#79B8FF", offset: 0 },
      { content: " = ", color: "#E1E4E8", offset: 1 },
      { content: "ab", color: "#79B8FF", offset: 4 },
    ];
    render(
      <HighlightedLine tokens={singleCharTokens} plainText="x = ab" onTokenClick={handleClick} />
    );
    // "x" is a single character identifier — should not be clickable
    const xSpan = screen.getByText("x");
    expect(xSpan.className).not.toContain("cursor-pointer");
    // "ab" is a multi-char identifier — should be clickable
    const abSpan = screen.getByText("ab");
    expect(abSpan.className).toContain("cursor-pointer");
  });
});
