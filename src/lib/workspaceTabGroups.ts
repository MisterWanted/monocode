import {
  focusedFileTab,
  leafIds,
  type WorkspaceTab,
} from "./layout";
import { projectName } from "./paths";
import type { Session } from "./session";

export function workspaceTabProject(
  tab: WorkspaceTab,
  sessions: Session[],
): string | null {
  for (const id of leafIds(tab.layout)) {
    const session = sessions.find((entry) => entry.id === id);
    if (session) {
      const name = projectName(session.cwd);
      return name === "~" ? null : name;
    }
  }

  const file = focusedFileTab(tab);
  if (file) {
    const name = projectName(file.cwd);
    return name === "~" ? null : name;
  }

  return null;
}

export function isGroupableProject(
  project: string | null,
): project is string {
  return !!project && project !== "~";
}

export function replaceGroupInTabOrder(
  allIds: string[],
  startIndex: number,
  length: number,
  newGroupIds: string[],
): string[] {
  const next = allIds.slice();
  next.splice(startIndex, length, ...newGroupIds);
  return next;
}
