import claude from "../assets/providers/claude.png";
import codex from "../assets/providers/codex.png";
import cursor from "../assets/providers/cursor.png";
import opencode from "../assets/providers/opencode.png";
import pi from "../assets/providers/pi.svg";
import type { HarnessId } from "../lib/session";

export const HARNESS_ICONS: Record<HarnessId, string> = {
  claude,
  codex,
  cursor,
  opencode,
  pi,
};

export function HarnessIcon({
  harness,
  className = "size-3.5",
}: {
  harness: HarnessId;
  className?: string;
}) {
  if (harness === "pi") {
    return (
      <svg
        viewBox="0 0 800 800"
        fill="currentColor"
        aria-hidden
        className={`block ${className}`}
      >
        <path
          fillRule="evenodd"
          d="M165.29 165.29H517.36V400H400V517.36H282.65V634.72H165.29ZM282.65 282.65V400H400V282.65Z"
        />
        <path d="M517.36 400H634.72V634.72H517.36Z" />
      </svg>
    );
  }
  return (
    <img
      src={HARNESS_ICONS[harness]}
      alt=""
      draggable={false}
      className={`block object-contain ${className}`}
    />
  );
}
