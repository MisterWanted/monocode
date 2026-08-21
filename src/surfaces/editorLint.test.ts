import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { python } from "@codemirror/lang-python";
import { EditorState, type Extension } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { isLintable, syntaxDiagnostics } from "./editorLint";

function stateWith(doc: string, language: Extension): EditorState {
  return EditorState.create({ doc, extensions: [language] });
}

describe("syntaxDiagnostics", () => {
  it("flags an unclosed brace", () => {
    const state = stateWith("function go() {\n  return 1;\n", javascript());
    const diagnostics = syntaxDiagnostics(state);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0].severity).toBe("error");
  });

  it("reports nothing for valid code", () => {
    const state = stateWith("const a = 1;\nexport { a };\n", javascript());
    expect(syntaxDiagnostics(state)).toEqual([]);
  });

  it("flags a trailing comma in JSON", () => {
    const state = stateWith('{ "a": 1, }', json());
    expect(syntaxDiagnostics(state).length).toBeGreaterThan(0);
  });

  it("reports nothing for valid JSON", () => {
    const state = stateWith('{ "a": [1, 2], "b": null }', json());
    expect(syntaxDiagnostics(state)).toEqual([]);
  });

  it("flags a broken Python statement", () => {
    const state = stateWith("def go(:\n    return 1\n", python());
    expect(syntaxDiagnostics(state).length).toBeGreaterThan(0);
  });

  it("names the token the parser choked on", () => {
    const state = stateWith("const a = 1;\n)\n", javascript());
    const messages = syntaxDiagnostics(state).map((d) => d.message);
    expect(messages.some((m) => m.includes('")"'))).toBe(true);
  });

  it("gives every diagnostic a visible range", () => {
    const state = stateWith("if (a {\n  b();\n}\n", javascript());
    const diagnostics = syntaxDiagnostics(state);
    expect(diagnostics.length).toBeGreaterThan(0);
    for (const diagnostic of diagnostics) {
      expect(diagnostic.to).toBeGreaterThan(diagnostic.from);
      expect(diagnostic.to).toBeLessThanOrEqual(state.doc.length);
    }
  });

  it("never widens a diagnostic across a line break", () => {
    const state = stateWith("const a = {\n", javascript());
    for (const diagnostic of syntaxDiagnostics(state)) {
      const line = state.doc.lineAt(diagnostic.from);
      expect(diagnostic.to).toBeLessThanOrEqual(line.to);
    }
  });

  it("caps the diagnostics for a file that resyncs badly", () => {
    const state = stateWith(")\n".repeat(400), javascript());
    expect(syntaxDiagnostics(state).length).toBeLessThanOrEqual(50);
  });

  it("skips a document past the size cap", () => {
    const state = stateWith(")".repeat(512 * 1024 + 1), javascript());
    expect(syntaxDiagnostics(state)).toEqual([]);
  });

  it("reports nothing without a language", () => {
    expect(syntaxDiagnostics(EditorState.create({ doc: "){}(" }))).toEqual([]);
  });
});

describe("isLintable", () => {
  it("accepts languages whose grammar reports errors", () => {
    for (const path of [
      "/a/b.ts",
      "/a/b.tsx",
      "/a/b.json",
      "/a/b.css",
      "/a/b.rs",
      "/a/b.py",
    ]) {
      expect(isLintable(path)).toBe(true);
    }
  });

  it("skips Markdown, whose parser accepts anything", () => {
    expect(isLintable("/a/README.md")).toBe(false);
    expect(isLintable("/a/b.mdx")).toBe(false);
  });

  it("skips files with no grammar", () => {
    expect(isLintable("/a/notes.txt")).toBe(false);
    expect(isLintable("/a/Makefile")).toBe(false);
  });
});
