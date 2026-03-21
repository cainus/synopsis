import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FolderPicker } from "./FolderPicker";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(null) }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

import { invoke } from "@tauri-apps/api/core";

describe("FolderPicker", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the choose folder button", () => {
    render(
      <FolderPicker repoPath={null} onPick={vi.fn()} onRefresh={vi.fn()} />
    );
    expect(
      screen.getByRole("button", { name: /choose repo folder/i })
    ).toBeInTheDocument();
  });

  it("does not show the path or refresh button when no repo is selected", () => {
    render(
      <FolderPicker repoPath={null} onPick={vi.fn()} onRefresh={vi.fn()} />
    );
    expect(screen.queryByTitle("Refresh")).not.toBeInTheDocument();
  });

  it("shows the repo path once selected", () => {
    render(
      <FolderPicker
        repoPath="/home/user/myrepo"
        onPick={vi.fn()}
        onRefresh={vi.fn()}
      />
    );
    expect(screen.getByText("/home/user/myrepo")).toBeInTheDocument();
  });

  it("shows the refresh button once a repo is selected", () => {
    render(
      <FolderPicker
        repoPath="/home/user/myrepo"
        onPick={vi.fn()}
        onRefresh={vi.fn()}
      />
    );
    expect(screen.getByTitle("Refresh")).toBeInTheDocument();
  });

  it("calls invoke pick_folder when the choose button is clicked", async () => {
    render(
      <FolderPicker repoPath={null} onPick={vi.fn()} onRefresh={vi.fn()} />
    );
    await userEvent.click(
      screen.getByRole("button", { name: /choose repo folder/i })
    );
    expect(invoke).toHaveBeenCalledWith("pick_folder");
  });

  it("calls onRefresh when the refresh button is clicked", async () => {
    const onRefresh = vi.fn();
    render(
      <FolderPicker
        repoPath="/home/user/myrepo"
        onPick={vi.fn()}
        onRefresh={onRefresh}
      />
    );
    await userEvent.click(screen.getByTitle("Refresh"));
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
