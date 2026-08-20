import { ensureClaudeRegistered } from "./claudeAdapter";
import { ensureCodexRegistered } from "./codexAdapter";
import { ensureCursorRegistered } from "./cursorAdapter";
import { ensureOpenCodeRegistered } from "./opencodeAdapter";

/** Register all known live harness adapters. Idempotent. */
export function registerBuiltinHarnesses(): void {
  ensureClaudeRegistered();
  ensureCursorRegistered();
  ensureCodexRegistered();
  ensureOpenCodeRegistered();
}
