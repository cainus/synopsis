import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchBar } from "./SearchBar";

describe("SearchBar", () => {
  it("renders text input, match count, nav buttons, and close button", () => {
    render(
      <SearchBar
        query=""
        onQueryChange={() => {}}
        matchCount={0}
        currentMatch={0}
        onNext={() => {}}
        onPrev={() => {}}
        onClose={() => {}}
      />
    );

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByLabelText("Next match")).toBeInTheDocument();
    expect(screen.getByLabelText("Previous match")).toBeInTheDocument();
    expect(screen.getByLabelText("Close search")).toBeInTheDocument();
  });

  it("displays match count as 'N of M' format", () => {
    render(
      <SearchBar
        query="test"
        onQueryChange={() => {}}
        matchCount={12}
        currentMatch={3}
        onNext={() => {}}
        onPrev={() => {}}
        onClose={() => {}}
      />
    );

    expect(screen.getByText("3 of 12")).toBeInTheDocument();
  });

  it("displays '0 of 0' when there are no matches", () => {
    render(
      <SearchBar
        query="test"
        onQueryChange={() => {}}
        matchCount={0}
        currentMatch={0}
        onNext={() => {}}
        onPrev={() => {}}
        onClose={() => {}}
      />
    );

    expect(screen.getByText("0 of 0")).toBeInTheDocument();
  });

  it("does not display match count when query is empty", () => {
    render(
      <SearchBar
        query=""
        onQueryChange={() => {}}
        matchCount={0}
        currentMatch={0}
        onNext={() => {}}
        onPrev={() => {}}
        onClose={() => {}}
      />
    );

    expect(screen.queryByText("0 of 0")).not.toBeInTheDocument();
  });

  it("calls onQueryChange when typing", async () => {
    const onQueryChange = vi.fn();
    const user = userEvent.setup();

    render(
      <SearchBar
        query=""
        onQueryChange={onQueryChange}
        matchCount={0}
        currentMatch={0}
        onNext={() => {}}
        onPrev={() => {}}
        onClose={() => {}}
      />
    );

    await user.type(screen.getByRole("textbox"), "a");
    expect(onQueryChange).toHaveBeenCalledWith("a");
  });

  it("calls onNext when clicking down arrow button", async () => {
    const onNext = vi.fn();
    const user = userEvent.setup();

    render(
      <SearchBar
        query="test"
        onQueryChange={() => {}}
        matchCount={5}
        currentMatch={1}
        onNext={onNext}
        onPrev={() => {}}
        onClose={() => {}}
      />
    );

    await user.click(screen.getByLabelText("Next match"));
    expect(onNext).toHaveBeenCalled();
  });

  it("calls onPrev when clicking up arrow button", async () => {
    const onPrev = vi.fn();
    const user = userEvent.setup();

    render(
      <SearchBar
        query="test"
        onQueryChange={() => {}}
        matchCount={5}
        currentMatch={2}
        onNext={() => {}}
        onPrev={onPrev}
        onClose={() => {}}
      />
    );

    await user.click(screen.getByLabelText("Previous match"));
    expect(onPrev).toHaveBeenCalled();
  });

  it("calls onClose when clicking close button", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <SearchBar
        query=""
        onQueryChange={() => {}}
        matchCount={0}
        currentMatch={0}
        onNext={() => {}}
        onPrev={() => {}}
        onClose={onClose}
      />
    );

    await user.click(screen.getByLabelText("Close search"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when Escape is pressed in the input", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <SearchBar
        query=""
        onQueryChange={() => {}}
        matchCount={0}
        currentMatch={0}
        onNext={() => {}}
        onPrev={() => {}}
        onClose={onClose}
      />
    );

    screen.getByRole("textbox").focus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onNext when Enter is pressed in the input", async () => {
    const onNext = vi.fn();
    const user = userEvent.setup();

    render(
      <SearchBar
        query="test"
        onQueryChange={() => {}}
        matchCount={5}
        currentMatch={1}
        onNext={onNext}
        onPrev={() => {}}
        onClose={() => {}}
      />
    );

    screen.getByRole("textbox").focus();
    await user.keyboard("{Enter}");
    expect(onNext).toHaveBeenCalled();
  });

  it("calls onPrev when Shift+Enter is pressed in the input", async () => {
    const onPrev = vi.fn();
    const user = userEvent.setup();

    render(
      <SearchBar
        query="test"
        onQueryChange={() => {}}
        matchCount={5}
        currentMatch={2}
        onNext={() => {}}
        onPrev={onPrev}
        onClose={() => {}}
      />
    );

    screen.getByRole("textbox").focus();
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(onPrev).toHaveBeenCalled();
  });
});
