import { describe, expect, it } from "vitest";
import { historyWithLiveSessions } from "./sessionHistory";
import { newSession } from "./session";
import type { SessionSummary } from "./sessionStore";

function summary(
  id: string,
  cwd: string,
  updatedAt = 1,
): SessionSummary {
  return {
    id,
    cwd,
    harness: "cursor",
    model: "gpt-5",
    runtimeMode: "supervised",
    title: `cursor · ${id}`,
    createdAt: updatedAt,
    updatedAt,
    additions: 0,
    deletions: 0,
  };
}

describe("historyWithLiveSessions", () => {
  it("drops persisted sessions from other projects", () => {
    const history = [
      summary("a1", "/tmp/project-a"),
      summary("b1", "/tmp/project-b"),
    ];
    const rows = historyWithLiveSessions(history, [], "/tmp/project-a");
    expect(rows.map((row) => row.id)).toEqual(["a1"]);
  });

  it("does not inject live sessions from other projects", () => {
    const session = newSession("cursor", "/tmp/project-b");
    session.blocks = [{ id: "u1", role: "user", text: "hello" }];
    session.busy = true;

    const rows = historyWithLiveSessions([], [session], "/tmp/project-a");
    expect(rows).toEqual([]);
  });

  it("includes live sessions for the active project", () => {
    const session = newSession("cursor", "/tmp/project-a");
    session.blocks = [{ id: "u1", role: "user", text: "hello" }];
    session.busy = true;

    const rows = historyWithLiveSessions([], [session], "/tmp/project-a");
    expect(rows.map((row) => row.id)).toEqual([session.id]);
  });

  it("matches project paths with trailing slashes", () => {
    const history = [summary("a1", "/tmp/project-a/")];

    const rows = historyWithLiveSessions(history, [], "/tmp/project-a");
    expect(rows.map((row) => row.id)).toEqual(["a1"]);
  });
});
