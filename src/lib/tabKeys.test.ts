import { describe, expect, it } from "vitest";
import { tabCommand } from "./tabKeys";

function key(
  partial: Partial<
    Pick<
      KeyboardEvent,
      | "key"
      | "code"
      | "metaKey"
      | "ctrlKey"
      | "altKey"
      | "shiftKey"
      | "isComposing"
    >
  >,
): KeyboardEvent {
  return {
    isComposing: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    key: "",
    code: "",
    ...partial,
  } as KeyboardEvent;
}

describe("tabCommand", () => {
  it("opens a terminal pane with cmd-backtick", () => {
    expect(tabCommand(key({ key: "`", code: "Backquote", metaKey: true }))).toBe(
      "new-terminal",
    );
  });

  it("opens a terminal workspace tab with shift-cmd-backtick", () => {
    expect(
      tabCommand(
        key({ key: "~", code: "Backquote", metaKey: true, shiftKey: true }),
      ),
    ).toBe("new-terminal-tab");
  });

  it("keeps existing tab chrome bindings", () => {
    expect(tabCommand(key({ key: "t", metaKey: true }))).toBe("new");
    expect(tabCommand(key({ key: "d", metaKey: true }))).toBe("split-right");
  });
});
