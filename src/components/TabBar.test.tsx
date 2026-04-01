import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TabBar } from "./TabBar";

describe("TabBar", () => {
  it("renders all five tabs", () => {
    render(<TabBar active="delta" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Summary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Files" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tests" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Diagrams" })).toBeInTheDocument();
  });

  it("marks the active tab with the active class", () => {
    render(<TabBar active="summary" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Summary" })).toHaveClass("active");
  });

  it("does not mark inactive tabs as active", () => {
    render(<TabBar active="summary" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Files" })).not.toHaveClass("active");
    expect(screen.getByRole("button", { name: "Tests" })).not.toHaveClass("active");
  });

  it("calls onChange with the correct tab id when clicked", async () => {
    const onChange = vi.fn();
    render(<TabBar active="delta" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Tests" }));
    expect(onChange).toHaveBeenCalledWith("tests");
  });

  it("shows a spinner on loading tabs", () => {
    render(<TabBar active="summary" onChange={vi.fn()} loading={{ summary: true, tests: true }} />);
    const summaryBtn = screen.getByRole("button", { name: /Summary/ });
    const testsBtn = screen.getByRole("button", { name: /Tests/ });
    const deltaBtn = screen.getByRole("button", { name: "Files" });
    expect(summaryBtn.querySelector(".tab-spinner")).toBeInTheDocument();
    expect(testsBtn.querySelector(".tab-spinner")).toBeInTheDocument();
    expect(deltaBtn.querySelector(".tab-spinner")).not.toBeInTheDocument();
  });
});
