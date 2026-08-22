import { invoke } from "@tauri-apps/api/core";
import { ask } from "@tauri-apps/plugin-dialog";
import {
  bindHarnessSession,
  forgetHarnessSession,
  isLiveHarness,
} from "./harness";
import {
  hasInFlightSessions,
  inFlightRefs,
  markTurnInterrupted,
  quitWhileBusyMessage,
  workspaceFromResumed,
  type ResumedWorkspace,
} from "./inFlight";
import type { WorkspaceTab } from "./layout";
import { killPty } from "./pty";
import type { Session } from "./session";
import {
  getSession,
  listInFlightSessions,
  replaceInFlightSessions,
  shouldPersistSession,
  upsertSession,
} from "./sessionStore";

export type { ResumedWorkspace };
export { hasInFlightSessions };

let resumedPromise: Promise<ResumedWorkspace | null> | null = null;
let quitting = false;
let quitDialogOpen = false;
let bootingResumed: ResumedWorkspace | null = null;
let liveWorkspace: {
  sessions: () => Session[];
  tabs: () => WorkspaceTab[];
  flush: () => void;
} | null = null;

export function isAppQuitting(): boolean {
  return quitting;
}

export function setQuitWorkspace(
  sessions: () => Session[],
  tabs: () => WorkspaceTab[],
  flush: () => void,
): () => void {
  liveWorkspace = { sessions, tabs, flush };
  bootingResumed = null;
  return () => {
    if (liveWorkspace?.sessions === sessions) liveWorkspace = null;
  };
}

export async function handleQuitRequested(): Promise<void> {
  if (liveWorkspace) {
    liveWorkspace.flush();
    await confirmQuitAndExit(liveWorkspace.sessions(), liveWorkspace.tabs());
    return;
  }
  if (bootingResumed) {
    quitting = true;
    try {
      await persistBootingResume(bootingResumed);
      await invoke("confirm_quit");
    } catch {
      quitting = false;
    }
    return;
  }
  await invoke("confirm_quit");
}

export function loadResumedWorkspace(): Promise<ResumedWorkspace | null> {
  if (!resumedPromise) resumedPromise = loadResumedWorkspaceOnce();
  return resumedPromise;
}

async function loadResumedWorkspaceOnce(): Promise<ResumedWorkspace | null> {
  const refs = await listInFlightSessions().catch(() => []);
  if (refs.length === 0) return null;
  const sessions: Session[] = [];
  for (const ref of refs) {
    const record = await getSession(ref.sessionId).catch(() => null);
    if (!record) continue;
    sessions.push(markTurnInterrupted(record));
  }
  const workspace = workspaceFromResumed(sessions);
  bootingResumed = workspace;
  if (workspace) {
    await Promise.all(
      workspace.sessions
        .filter(shouldPersistSession)
        .map((session) => upsertSession(session).catch(() => null)),
    );
  }
  return workspace;
}

export function bindResumedSessions(sessions: Session[]): void {
  for (const session of sessions) {
    if (!session.providerSessionId || !isLiveHarness(session.harness)) continue;
    bindHarnessSession(
      session.harness,
      session.id,
      session.providerSessionId,
      session.cwd,
    );
  }
}

export async function hideCurrentWindow(): Promise<void> {
  await invoke("hide_window");
}

export async function closeCurrentWindow(): Promise<void> {
  await invoke("destroy_window");
}

export async function persistLiveTranscripts(
  sessions: Session[],
): Promise<void> {
  await Promise.all(
    sessions
      .filter(shouldPersistSession)
      .map((session) => upsertSession(session).catch(() => null)),
  );
}

export async function persistQuitState(
  sessions: Session[],
  tabs: WorkspaceTab[],
  mode: "quit" | "unload" = "quit",
): Promise<void> {
  const refs = inFlightRefs(sessions, tabs);
  const interrupted = new Set(refs.map((ref) => ref.sessionId));
  await Promise.all(
    sessions.map(async (session) => {
      if (!shouldPersistSession(session)) return;
      const payload = interrupted.has(session.id)
        ? markTurnInterrupted(session)
        : session;
      await upsertSession(payload).catch(() => null);
    }),
  );
  // Vite/webview reload must not wipe a restored snapshot: those chats are idle
  // in this process until Continue runs.
  if (mode === "quit" || refs.length > 0) {
    await replaceInFlightSessions(refs).catch(() => undefined);
  }
}

async function persistBootingResume(workspace: ResumedWorkspace): Promise<void> {
  await Promise.all(
    workspace.sessions
      .filter(shouldPersistSession)
      .map((session) => upsertSession(session).catch(() => null)),
  );
  await replaceInFlightSessions(
    workspace.sessions.map((session) => ({
      sessionId: session.id,
      cwd: session.cwd,
    })),
  ).catch(() => undefined);
}

async function confirmQuitAndExit(
  sessions: Session[],
  tabs: WorkspaceTab[],
): Promise<void> {
  if (quitDialogOpen) return;
  quitDialogOpen = true;
  try {
    const refs = inFlightRefs(sessions, tabs);
    if (refs.length > 0) {
      const ok = await ask(quitWhileBusyMessage(refs.length), {
        title: "MonoCode",
        kind: "warning",
        okLabel: "Quit",
      });
      if (!ok) return;
    }
    quitting = true;
    try {
      await persistQuitState(sessions, tabs);
      await invoke("confirm_quit");
    } catch {
      quitting = false;
    }
  } finally {
    quitDialogOpen = false;
  }
}

export async function reapWindowRuntime(
  sessions: Session[],
  tabs: WorkspaceTab[],
): Promise<void> {
  await Promise.all(
    sessions.map((session) => forgetHarnessSession(session.harness, session.id)),
  );
  await Promise.all(terminalFileIds(tabs).map((id) => killPty(id)));
}

function terminalFileIds(tabs: WorkspaceTab[]): string[] {
  const ids: string[] = [];
  for (const tab of tabs) {
    for (const pane of [...tab.editorPanes, ...(tab.terminalPanes ?? [])]) {
      for (const file of pane.files) {
        if (file.terminal) ids.push(file.id);
      }
    }
  }
  return ids;
}
