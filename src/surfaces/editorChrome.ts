import { HighlightStyle, LanguageSupport } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { cspStyleNonce } from "../lib/csp";
import { basename } from "../lib/fs";

const editorThemeStyles = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "transparent",
      color: "var(--color-content)",
      fontSize: "13px",
      userSelect: "text",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-scroller": {
      overflow: "auto",
      overscrollBehavior: "none",
      fontFamily: "var(--font-mono)",
      lineHeight: "1.6",
    },
    ".cm-content": {
      minHeight: "100%",
      padding: "8px 0 32px",
      caretColor: "var(--color-content)",
    },
    ".cm-line": {
      padding: "0 12px 0 6px",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "color-mix(in srgb, var(--color-content) 38%, transparent)",
      borderRight:
        "1px solid color-mix(in srgb, var(--color-content) 7%, transparent)",
      paddingLeft: "4px",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      minWidth: "36px",
      padding: "0 8px 0 4px",
    },
    ".cm-foldGutter": {
      width: "12px",
    },
    ".cm-foldGutter .cm-gutterElement": {
      padding: "0 2px",
      cursor: "pointer",
      color: "color-mix(in srgb, var(--color-content) 45%, transparent)",
    },
    ".cm-foldPlaceholder": {
      color: "color-mix(in srgb, var(--color-content) 40%, transparent)",
    },
    ".cm-activeLine": {
      backgroundColor: "color-mix(in srgb, var(--color-content) 10%, transparent)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "color-mix(in srgb, var(--color-content) 10%, transparent)",
      color: "color-mix(in srgb, var(--color-content) 70%, transparent)",
    },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection":
      {
        backgroundColor:
          "color-mix(in srgb, var(--color-accent) 35%, transparent) !important",
      },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--color-content)",
    },
    ".cm-matchingBracket": {
      backgroundColor:
        "color-mix(in srgb, var(--color-content) 14%, transparent)",
      outline:
        "1px solid color-mix(in srgb, var(--color-content) 28%, transparent)",
    },
    ".cm-nonmatchingBracket": {
      backgroundColor: "color-mix(in srgb, #f87171 32%, transparent)",
      outline: "1px solid color-mix(in srgb, #f87171 55%, transparent)",
    },
    ".cm-panels, .cm-tooltip": {
      backgroundColor: "var(--color-background-base)",
      color: "var(--color-content)",
    },
    ".cm-panels": {
      borderColor: "color-mix(in srgb, var(--color-content) 10%, transparent)",
    },
    ".cm-tooltip": {
      border:
        "1px solid color-mix(in srgb, var(--color-content) 12%, transparent)",
      borderRadius: "6px",
      overflow: "hidden",
    },
    ".cm-tooltip.cm-tooltip-autocomplete": {
      backgroundColor: "var(--color-background-base)",
    },
    ".cm-tooltip-autocomplete > ul": {
      fontFamily: "var(--font-mono)",
      fontSize: "12px",
      maxHeight: "240px",
    },
    ".cm-tooltip-autocomplete > ul > li": {
      padding: "2px 8px",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor:
        "color-mix(in srgb, var(--color-accent) 25%, transparent)",
      color: "var(--color-content)",
    },
    ".cm-completionDetail": {
      color: "color-mix(in srgb, var(--color-content) 50%, transparent)",
      fontStyle: "normal",
      marginLeft: "8px",
    },
  },
  { dark: true },
);

/**
 * The theme, plus whatever CSP nonce its style sheet needs. CodeMirror mounts
 * every rule it owns — base theme included — through style-mod at runtime, so a
 * style-src that rejects inline sheets leaves the editor completely unstyled.
 * See `cspStyleNonce` for why this is currently a no-op.
 */
export const editorTheme: Extension = [
  editorThemeStyles,
  EditorView.cspNonce.of(cspStyleNonce()),
];

export const editorHighlightStyle = HighlightStyle.define([
  {
    tag: [
      tags.keyword,
      tags.controlKeyword,
      tags.definitionKeyword,
      tags.moduleKeyword,
      tags.operatorKeyword,
      tags.modifier,
      tags.self,
      tags.bool,
      tags.null,
      tags.atom,
      tags.unit,
    ],
    color: "#ff8ffd",
  },
  {
    tag: [
      tags.function(tags.variableName),
      tags.function(tags.propertyName),
      tags.labelName,
      tags.macroName,
    ],
    color: "#a5d5fe",
  },
  {
    tag: [
      tags.string,
      tags.docString,
      tags.character,
      tags.attributeValue,
      tags.special(tags.string),
      tags.regexp,
      tags.escape,
    ],
    color: "#b4fa72",
  },
  {
    tag: [
      tags.typeName,
      tags.className,
      tags.namespace,
      tags.tagName,
      tags.standard(tags.typeName),
    ],
    color: "#ff8272",
  },
  {
    tag: [tags.number, tags.integer, tags.float],
    color: "#b4fa72",
  },
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment],
    color: "#fefdc2",
  },
  {
    tag: [tags.propertyName, tags.attributeName],
    color: "#d0d1fe",
  },
  {
    tag: [tags.meta, tags.processingInstruction, tags.annotation],
    color: "#8e8e8e",
  },
  {
    tag: tags.invalid,
    color: "#ffc4bd",
    textDecoration: "underline",
  },
]);

export async function languageForPath(path: string): Promise<Extension | null> {
  const name = basename(path).toLowerCase();
  const extension = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";

  if ([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"].includes(extension)) {
    const { javascript } = await import("@codemirror/lang-javascript");
    return javascript({
      jsx: extension === ".jsx" || extension === ".tsx",
      typescript: extension === ".ts" || extension === ".tsx",
    });
  }
  if (extension === ".json" || name === "package-lock.json") {
    const { json } = await import("@codemirror/lang-json");
    return json();
  }
  if (extension === ".css") {
    const { css } = await import("@codemirror/lang-css");
    return css();
  }
  if ([".html", ".htm"].includes(extension)) {
    const { html } = await import("@codemirror/lang-html");
    return html();
  }
  if ([".md", ".mdx", ".markdown"].includes(extension)) {
    const { markdown } = await import("@codemirror/lang-markdown");
    return markdown();
  }
  if (extension === ".rs") {
    const { rustLanguage } = await import("@codemirror/lang-rust");
    const { completeFromList } = await import("@codemirror/autocomplete");
    const keywords =
      "as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while"
        .split(" ")
        .map((label) => ({ label, type: "keyword" }));
    return new LanguageSupport(rustLanguage, [
      rustLanguage.data.of({ autocomplete: completeFromList(keywords) }),
    ]);
  }
  if (extension === ".py") {
    const { python } = await import("@codemirror/lang-python");
    return python();
  }
  return null;
}
