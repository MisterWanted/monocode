import { sameProjectPath } from "./recents";
import { hasPendingApproval, type Session } from "./session";
import { shouldPersistSession, type SessionSummary } from "./sessionStore";

export function mergeHistorySummary(
  current: SessionSummary[],
  summary: SessionSummary,
): SessionSummary[] {
  return [summary, ...current.filter((entry) => entry.id !== summary.id)].sort(
    (a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id),
  );
}

export function summaryFromSession(session: Session): SessionSummary {
  return {
    id: session.id,
    cwd: session.cwd,
    harness: session.harness,
    model: session.model,
    runtimeMode: session.runtimeMode,
    title: session.title,
    providerSessionId: session.providerSessionId,
    createdAt: 0,
    updatedAt: Date.now(),
  };
}

export function historyWithLiveSessions(
  history: SessionSummary[],
  sessions: Session[],
  cwd: string,
): SessionSummary[] {
  let rows = history.filter((entry) => sameProjectPath(entry.cwd, cwd));
  for (const session of sessions) {
    if (!sameProjectPath(session.cwd, cwd)) continue;
    const live = session.busy || hasPendingApproval(session.blocks);
    if (!shouldPersistSession(session) && !live) continue;
    if (rows.some((row) => row.id === session.id)) continue;
    rows = mergeHistorySummary(rows, summaryFromSession(session));
  }
  return rows;
}
