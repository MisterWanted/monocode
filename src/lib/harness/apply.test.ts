import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { newSession } from "../session";
import { appendUser, applyHarnessEvent, appendSteerUser, stopStreaming } from "./apply";

let now = 0;

beforeEach(() => {
  now = 0;
  vi.spyOn(Date, "now").mockImplementation(() => now);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("turn duration", () => {
  it("stamps how long the agent worked when the turn ends", () => {
    now = 1_000;
    let session = appendUser(newSession("cursor", "/tmp"), "hi");
    expect(session.busy).toBe(true);
    expect(session.blocks[0]?.startedAt).toBe(1_000);
    expect(session.blocks[0]?.durationMs).toBeUndefined();

    now = 26_000;
    session = stopStreaming(session);
    expect(session.busy).toBe(false);
    expect(session.blocks[0]?.durationMs).toBe(25_000);
  });

  it("does not overwrite a duration already recorded", () => {
    now = 1_000;
    let session = appendUser(newSession("cursor", "/tmp"), "hi");
    now = 5_000;
    session = stopStreaming(session);
    now = 90_000;
    session = stopStreaming(session);
    expect(session.blocks[0]?.durationMs).toBe(4_000);
  });

  it("records duration when the turn errors", () => {
    now = 1_000;
    let session = appendUser(newSession("cursor", "/tmp"), "hi");
    now = 8_000;
    session = applyHarnessEvent(session, {
      type: "session.error",
      message: "boom",
    });
    expect(session.busy).toBe(false);
    expect(session.blocks[0]?.durationMs).toBe(7_000);
  });
});

describe("appendSteerUser", () => {
  it("appends a user message without sealing an in-flight assistant block", () => {
    let session = appendUser(newSession("cursor", "/tmp"), "build it");
    session = applyHarnessEvent(session, {
      type: "message.delta",
      text: "Working on it",
    });
    expect(session.blocks[1]?.streaming).toBe(true);

    session = appendSteerUser(session, "focus on tests");
    expect(session.blocks).toHaveLength(3);
    expect(session.blocks[1]?.streaming).toBe(true);
    expect(session.blocks[2]).toMatchObject({
      role: "user",
      text: "focus on tests",
    });
    expect(session.blocks[2]?.startedAt).toBeUndefined();
    expect(session.busy).toBe(true);
  });
});

describe("status blocks", () => {
  it("keeps one row when the same status repeats", () => {
    let session = appendUser(newSession("claude", "/tmp"), "go");
    session = applyHarnessEvent(session, {
      type: "status",
      text: "Retrying in 3s",
    });
    session = applyHarnessEvent(session, {
      type: "status",
      text: "Retrying in 3s",
    });
    const system = session.blocks.filter((block) => block.role === "system");
    expect(system).toHaveLength(1);
    expect(system[0]?.text).toBe("Retrying in 3s");
  });

  it("still appends a status that differs from the last one", () => {
    let session = appendUser(newSession("claude", "/tmp"), "go");
    session = applyHarnessEvent(session, { type: "status", text: "Retrying" });
    session = applyHarnessEvent(session, { type: "status", text: "Compacting" });
    expect(
      session.blocks.filter((block) => block.role === "system"),
    ).toHaveLength(2);
  });

  it("ignores blank status text", () => {
    let session = appendUser(newSession("claude", "/tmp"), "go");
    session = applyHarnessEvent(session, { type: "status", text: "  " });
    expect(session.blocks.some((block) => block.role === "system")).toBe(false);
  });
});
