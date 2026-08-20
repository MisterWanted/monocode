import { describe, expect, it } from "vitest";
import { newTab, type WorkspaceTab } from "./layout";
import type { Session } from "./session";
import {
  replaceGroupInTabOrder,
  workspaceTabProject,
} from "./workspaceTabGroups";

function session(id: string, cwd: string): Session {
  return {
    id,
    cwd,
    harness: "cursor",
    title: "",
    blocks: [],
    busy: false,
    model: "",
  };
}

function tab(id: string, sessionId: string): WorkspaceTab {
  return { ...newTab(sessionId), id };
}

describe("workspaceTabProject", () => {
  it("reads project from the tab session cwd", () => {
    const workspace = tab("t1", "s1");
    const sessions = [session("s1", "/Users/me/agent-terminal")];
    expect(workspaceTabProject(workspace, sessions)).toBe("agent-terminal");
  });
});

describe("replaceGroupInTabOrder", () => {
  it("swaps a contiguous slice of ids", () => {
    expect(replaceGroupInTabOrder(["a", "b", "c", "d"], 1, 2, ["d", "c"])).toEqual([
      "a",
      "d",
      "c",
      "d",
    ]);
  });
});
