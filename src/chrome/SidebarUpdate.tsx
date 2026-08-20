import { ArrowDownCircle, Loader, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  installPendingUpdate,
  probeForUpdate,
  readAppVersion,
  runUpdateFlow,
  type UpdaterSnapshot,
} from "../lib/updater";

export function SidebarUpdate() {
  const [snapshot, setSnapshot] = useState<UpdaterSnapshot>({
    phase: "idle",
    currentVersion: "…",
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const currentVersion = await readAppVersion();
      if (cancelled) return;
      setSnapshot({ phase: "checking", currentVersion });

      try {
        const update = await probeForUpdate();
        if (cancelled) return;
        if (update) {
          setSnapshot({
            phase: "available",
            currentVersion,
            availableVersion: update.version,
          });
          return;
        }
        setSnapshot({ phase: "current", currentVersion });
      } catch {
        if (cancelled) return;
        setSnapshot({ phase: "idle", currentVersion });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const onClick = useCallback(async () => {
    if (snapshot.phase === "downloading" || snapshot.phase === "checking") {
      return;
    }

    if (snapshot.phase === "available") {
      await installPendingUpdate(setSnapshot);
      return;
    }

    await runUpdateFlow(true, setSnapshot);
  }, [snapshot.phase]);

  const busy =
    snapshot.phase === "checking" || snapshot.phase === "downloading";
  const hasUpdate = snapshot.phase === "available";
  const label = hasUpdate
    ? `Update to ${snapshot.availableVersion}`
    : busy
      ? snapshot.phase === "downloading"
        ? `Downloading${snapshot.progress != null ? ` ${snapshot.progress}%` : "…"}`
        : "Checking…"
      : "Check for updates";

  return (
    <div className="shrink-0 border-t border-content/10 p-2">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] leading-tight transition-colors ${
          hasUpdate
            ? "bg-accent/15 text-content hover:bg-accent/20"
            : "text-content/50 hover:bg-content/5 hover:text-content"
        } disabled:cursor-default disabled:opacity-70`}
      >
        <span className="grid size-5 shrink-0 place-items-center">
          {busy ? (
            <Loader className="size-3.5 animate-spin" aria-hidden />
          ) : hasUpdate ? (
            <ArrowDownCircle className="size-3.5 text-accent" aria-hidden />
          ) : (
            <RefreshCw className="size-3.5" aria-hidden />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{label}</span>
          <span className="block truncate text-[11px] text-content/40">
            v{snapshot.currentVersion}
          </span>
        </span>
      </button>
    </div>
  );
}
