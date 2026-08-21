import claude from "../assets/providers/claude.png";
import codex from "../assets/providers/codex.png";
import cursor from "../assets/providers/cursor.png";
import opencode from "../assets/providers/opencode.png";
import type { HarnessId } from "../lib/session";

export const HARNESS_ICONS: Record<HarnessId, string> = {
  claude,
  codex,
  cursor,
  opencode,
};

export function HarnessIcon({
  harness,
  className = "size-3.5",
}: {
  harness: HarnessId;
  className?: string;
}) {
  return (
    <img
      src={HARNESS_ICONS[harness]}
      alt=""
      draggable={false}
      className={`block object-contain ${className}`}
    />
  );
}
