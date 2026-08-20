import { describe, expect, it } from "vitest";
import { newTerminalFile } from "./layout";
import {
  defaultTerminalTitle,
  scanOscCwd,
  terminalTabLabel,
} from "./terminalTab";

describe("defaultTerminalTitle", () => {
  it("uses the directory basename", () => {
    expect(defaultTerminalTitle("/Users/dev/agent-terminal")).toBe(
      "agent-terminal",
    );
    expect(defaultTerminalTitle("/")).toBe("Terminal");
  });
});

describe("terminalTabLabel", () => {
  it("prefers the dynamic title on the tab", () => {
    const file = newTerminalFile("/repo", "npm");
    expect(terminalTabLabel(file)).toBe("npm");
  });
});

describe("scanOscCwd", () => {
  it("extracts cwd from OSC 7 reports", () => {
    const chunk = "\x1b]7;file://host/Users/dev/repo\x07";
    const { cwd, rest } = scanOscCwd(chunk, "");
    expect(cwd).toBe("/Users/dev/repo");
    expect(rest).toBe("");
  });

  it("keeps a trailing buffer for split sequences", () => {
    const partial = "\x1b]7;file://host/Users/dev";
    const { cwd, rest } = scanOscCwd("/repo\x07", partial);
    expect(cwd).toBe("/Users/dev/repo");
    expect(rest).toBe("");
  });
});
