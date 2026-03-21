import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SummaryTab } from "./SummaryTab";

describe("SummaryTab", () => {
  it("shows empty state before a repo is picked", () => {
    render(
      <SummaryTab
        lines={[]}
        loading={false}
        done={false}
        hasRepo={false}
        onGenerate={vi.fn()}
      />
    );
    expect(screen.getByText(/pick a repo folder/i)).toBeInTheDocument();
  });

  it("shows generate button when repo is picked but summary not started", () => {
    render(
      <SummaryTab
        lines={[]}
        loading={false}
        done={false}
        hasRepo={true}
        onGenerate={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: /generate summary/i })
    ).toBeInTheDocument();
  });

  it("calls onGenerate when the button is clicked", async () => {
    const onGenerate = vi.fn();
    render(
      <SummaryTab
        lines={[]}
        loading={false}
        done={false}
        hasRepo={true}
        onGenerate={onGenerate}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: /generate summary/i })
    );
    expect(onGenerate).toHaveBeenCalledOnce();
  });

  it("shows spinner while loading with no output yet", () => {
    render(
      <SummaryTab
        lines={[]}
        loading={true}
        done={false}
        hasRepo={true}
        onGenerate={vi.fn()}
      />
    );
    expect(screen.getByText(/claude is thinking/i)).toBeInTheDocument();
    expect(document.querySelector(".spinner")).toBeInTheDocument();
  });

  it("renders streamed lines as text", () => {
    render(
      <SummaryTab
        lines={["First line", "Second line"]}
        loading={true}
        done={false}
        hasRepo={true}
        onGenerate={vi.fn()}
      />
    );
    expect(screen.getByText(/First line/)).toBeInTheDocument();
    expect(screen.getByText(/Second line/)).toBeInTheDocument();
  });

  it("renders markdown formatting", () => {
    render(
      <SummaryTab
        lines={["## Summary", "- item one", "- item two"]}
        loading={false}
        done={true}
        hasRepo={true}
        onGenerate={vi.fn()}
      />
    );
    expect(screen.getByRole("heading", { name: /summary/i })).toBeInTheDocument();
    expect(screen.getByText("item one")).toBeInTheDocument();
    expect(screen.getByText("item two")).toBeInTheDocument();
  });

  it("shows a blinking cursor while loading with partial output", () => {
    render(
      <SummaryTab
        lines={["partial output"]}
        loading={true}
        done={false}
        hasRepo={true}
        onGenerate={vi.fn()}
      />
    );
    expect(screen.getByText("▌")).toBeInTheDocument();
  });

  it("hides the cursor once done", () => {
    render(
      <SummaryTab
        lines={["complete output"]}
        loading={false}
        done={true}
        hasRepo={true}
        onGenerate={vi.fn()}
      />
    );
    expect(screen.queryByText("▌")).not.toBeInTheDocument();
  });
});
