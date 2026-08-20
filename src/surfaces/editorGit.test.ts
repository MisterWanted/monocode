import { Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { Chunk } from "@codemirror/merge";
import {
  findChunk,
  revertChunkText,
  deletedLineTexts,
  overviewTicks,
  stateWithGitOriginal,
} from "./editorGit";

describe("revertChunkText", () => {
  it("restores a deleted line", () => {
    const original = "alpha\nbeta\ngamma\n";
    const current = "alpha\ngamma\n";
    const reverted = revertChunkText(original, current, 6);
    expect(reverted).toBe(original);
  });

  it("removes an added line", () => {
    const original = "alpha\ngamma\n";
    const current = "alpha\nbeta\ngamma\n";
    const reverted = revertChunkText(original, current, 6);
    expect(reverted).toBe(original);
  });

  it("restores a modified hunk", () => {
    const original = "alpha\nbeta\ngamma\n";
    const current = "alpha\nBETA\ngamma\n";
    const reverted = revertChunkText(original, current, 6);
    expect(reverted).toBe(original);
  });

  it("returns null when the cursor is on an unchanged line", () => {
    const original = "alpha\nbeta\ngamma\n";
    const current = "alpha\nBETA\ngamma\n";
    expect(revertChunkText(original, current, 0)).toBeNull();
  });
});

describe("deletedLineTexts", () => {
  it("returns the removed lines for a deletion hunk", () => {
    const original = Text.of("alpha\nbeta\ngamma\n".split("\n"));
    const current = Text.of("alpha\ngamma\n".split("\n"));
    const chunks = Chunk.build(original, current, {
      scanLimit: 5_000,
      timeout: 100,
    });
    const chunk = chunks.find((entry) => entry.fromA !== entry.toA);
    expect(chunk).toBeTruthy();
    expect(deletedLineTexts(original, chunk!)).toEqual(["beta"]);
  });
});

describe("overviewTicks", () => {
  it("maps added, deleted, and modified hunks", () => {
    const added = Chunk.build(
      Text.of("alpha\ngamma\n".split("\n")),
      Text.of("alpha\nbeta\ngamma\n".split("\n")),
    );
    expect(overviewTicks(Text.of("alpha\nbeta\ngamma\n".split("\n")), added, null)).toEqual([
      { kind: "add", top: 1 / 4, size: 1 / 4, pos: 6 },
    ]);

    const original = Text.of("alpha\nbeta\ngamma\n".split("\n"));
    const deletedDoc = Text.of("alpha\ngamma\n".split("\n"));
    const deleted = Chunk.build(original, deletedDoc);
    const delTicks = overviewTicks(deletedDoc, deleted, original);
    expect(delTicks).toHaveLength(1);
    expect(delTicks[0]?.kind).toBe("del");

    const modified = Chunk.build(
      Text.of("alpha\nbeta\ngamma\n".split("\n")),
      Text.of("alpha\nBETA\ngamma\n".split("\n")),
    );
    const modTicks = overviewTicks(
      Text.of("alpha\nBETA\ngamma\n".split("\n")),
      modified,
      null,
    );
    expect(modTicks[0]?.kind).toBe("mod");
  });
});

describe("findChunk", () => {
  it("finds a pure deletion on the following line", () => {
    const original = Text.of("alpha\nbeta\ngamma\n".split("\n"));
    const current = Text.of("alpha\ngamma\n".split("\n"));
    const chunks = Chunk.build(original, current, {
      scanLimit: 5_000,
      timeout: 100,
    });
    const chunk = findChunk(current, chunks, current.line(2).from);
    expect(chunk).toBeTruthy();
    expect(chunk?.fromA).not.toBe(chunk?.toA);
    expect(chunk?.fromB).toBe(chunk?.toB);
  });
});

describe("stateWithGitOriginal", () => {
  it("decorates added, deleted, and modified hunks", () => {
    expect(() =>
      stateWithGitOriginal("alpha\nBETA\ngamma\n", "alpha\nbeta\ngamma\n"),
    ).not.toThrow();
    expect(() =>
      stateWithGitOriginal("alpha\nbeta\ngamma\n", "alpha\ngamma\n"),
    ).not.toThrow();
    expect(() =>
      stateWithGitOriginal("alpha\ngamma\n", "alpha\nbeta\ngamma\n"),
    ).not.toThrow();
    expect(() =>
      stateWithGitOriginal("hello\nworld\n", ""),
    ).not.toThrow();
  });
});
