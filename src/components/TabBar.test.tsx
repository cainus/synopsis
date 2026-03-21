import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TabBar } from "./TabBar";

describe("TabBar", () => {
  it("renders all three tabs", () => {
    render(<TabBar active="delta" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Delta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Summary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tests" })).toBeInTheDocument();
  });

  it("marks the active tab with the active class", () => {
    render(<TabBar active="summary" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Summary" })).toHaveClass(
      "active"
    );
  });

  it("does not mark inactive tabs as active", () => {
    render(<TabBar active="summary" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Delta" })).not.toHaveClass(
      "active"
    );
    expect(screen.getByRole("button", { name: "Tests" })).not.toHaveClass(
      "active"
    );
  });

  it("calls onChange with the correct tab id when clicked", async () => {
    const onChange = vi.fn();
    render(<TabBar active="delta" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Tests" }));
    expect(onChange).toHaveBeenCalledWith("tests");
  });
});
