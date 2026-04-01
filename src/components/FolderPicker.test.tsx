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
      <FolderPicker repoPath={null} onPick={vi.fn()} onRefresh={vi.fn()} recentPaths={[]} />
    );
    expect(
      screen.getByRole("button", { name: /choose repo folder/i })
    ).toBeInTheDocument();
  });

  it("does not show the path or refresh button when no repo is selected", () => {
    render(
      <FolderPicker repoPath={null} onPick={vi.fn()} onRefresh={vi.fn()} recentPaths={[]} />
    );
    expect(screen.queryByTitle("Refresh")).not.toBeInTheDocument();
  });

  it("shows the repo path once selected", () => {
    render(
      <FolderPicker
        repoPath="/home/user/myrepo"
        onPick={vi.fn()}
        onRefresh={vi.fn()}
        recentPaths={["/home/user/myrepo"]}
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
        recentPaths={["/home/user/myrepo"]}
      />
    );
    expect(screen.getByTitle("Refresh")).toBeInTheDocument();
  });

  it("calls invoke pick_folder when the choose button is clicked", async () => {
    render(
      <FolderPicker repoPath={null} onPick={vi.fn()} onRefresh={vi.fn()} recentPaths={[]} />
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
        recentPaths={["/home/user/myrepo"]}
      />
    );
    await userEvent.click(screen.getByTitle("Refresh"));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("does not show the recents button when there are no other recent paths", () => {
    render(
      <FolderPicker
        repoPath="/home/user/myrepo"
        onPick={vi.fn()}
        onRefresh={vi.fn()}
        recentPaths={["/home/user/myrepo"]}
      />
    );
    expect(screen.queryByText(/recent/i)).not.toBeInTheDocument();
  });

  it("shows the recents button when there are other recent paths", () => {
    render(
      <FolderPicker
        repoPath="/home/user/myrepo"
        onPick={vi.fn()}
        onRefresh={vi.fn()}
        recentPaths={["/home/user/myrepo", "/home/user/other"]}
      />
    );
    expect(screen.getByText(/recent/i)).toBeInTheDocument();
  });

  it("shows recent paths in dropdown after clicking the recents button", async () => {
    render(
      <FolderPicker
        repoPath="/home/user/myrepo"
        onPick={vi.fn()}
        onRefresh={vi.fn()}
        recentPaths={["/home/user/myrepo", "/home/user/other", "/home/user/third"]}
      />
    );
    await userEvent.click(screen.getByText(/recent/i));
    expect(await screen.findByText("/home/user/other")).toBeInTheDocument();
    expect(await screen.findByText("/home/user/third")).toBeInTheDocument();
  });

  it("does not show the current repo path in the recents dropdown", async () => {
    render(
      <FolderPicker
        repoPath="/home/user/myrepo"
        onPick={vi.fn()}
        onRefresh={vi.fn()}
        recentPaths={["/home/user/myrepo", "/home/user/other"]}
      />
    );
    await userEvent.click(screen.getByText(/recent/i));
    // The dropdown items should not include the current path
    const menuItems = document.querySelectorAll('[data-slot="menu-item"]');
    const paths = Array.from(menuItems).map((el) => el.textContent);
    expect(paths).not.toContain("/home/user/myrepo");
  });

  it("calls onPick with the selected recent path", async () => {
    const onPick = vi.fn();
    render(
      <FolderPicker
        repoPath="/home/user/myrepo"
        onPick={onPick}
        onRefresh={vi.fn()}
        recentPaths={["/home/user/myrepo", "/home/user/other"]}
      />
    );
    await userEvent.click(screen.getByText(/recent/i));
    await userEvent.click(await screen.findByText("/home/user/other"));
    expect(onPick).toHaveBeenCalledWith("/home/user/other");
  });
});
