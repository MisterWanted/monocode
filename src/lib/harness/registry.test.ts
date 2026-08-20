import { describe, expect, it } from "vitest";
import {
  isLiveHarness,
  listHarnesses,
  registerHarness,
  type HarnessAdapter,
} from "./registry";
import type { SendTurnInput, SteerTurnInput } from "./types";

function stub(id: "cursor" | "codex" | "claude", live: boolean): HarnessAdapter {
  return {
    id,
    live,
    async sendTurn(_input: SendTurnInput) {},
    async steerTurn(_input: SteerTurnInput) {},
    async cancelTurn() {},
    respondApproval() {},
    async stopSession() {},
    async forgetSession() {},
    bindSession() {},
  };
}

describe("harness registry", () => {
  it("tracks live adapters", () => {
    registerHarness(stub("cursor", true));
    registerHarness(stub("codex", true));
    registerHarness(stub("claude", true));
    expect(isLiveHarness("cursor")).toBe(true);
    expect(isLiveHarness("codex")).toBe(true);
    expect(isLiveHarness("claude")).toBe(true);
    expect(listHarnesses().map((a) => a.id).sort()).toEqual([
      "claude",
      "codex",
      "cursor",
    ]);
  });
});
