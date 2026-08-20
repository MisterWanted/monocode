import { basename } from "./fs";
import type { FilePaneTab } from "./layout";

export type TerminalMetaPatch = {
  title?: string;
  cwd?: string;
};

/** Default tab label from the working directory. */
export function defaultTerminalTitle(cwd: string): string {
  const name = basename(cwd);
  if (!name || name === "/") return "Terminal";
  return name;
}

/** Tab label: dynamic title (process or directory) stored on `path`. */
export function terminalTabLabel(file: FilePaneTab): string {
  return file.path?.trim() || defaultTerminalTitle(file.cwd);
}

const OSC_CWD =
  /\x1b\]7;file:\/\/[^/]*(\/[^\x07\x1b]*)(?:\x07|\x1b\\)/g;

function decodeOscPath(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Scan PTY output for OSC 7 cwd reports from shell integration. */
export function scanOscCwd(
  chunk: string,
  buffer: string,
): { cwd?: string; rest: string } {
  const merged = buffer + chunk;
  let cwd: string | undefined;
  let last = 0;
  for (const match of merged.matchAll(OSC_CWD)) {
    const index = match.index ?? 0;
    const path = decodeOscPath(match[1] ?? "");
    if (path) cwd = path;
    last = index + match[0].length;
  }
  const tail = merged.slice(last);
  const rest = tail.length > 256 ? tail.slice(-256) : tail;
  return { cwd, rest };
}
