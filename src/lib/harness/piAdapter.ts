import {
  bindPiSession,
  cancelPiTurn,
  forgetPiSession,
  respondPiApproval,
  sendPiTurn,
  steerPiTurn,
  stopPiSession,
} from "./pi";
import { refreshPiCatalog } from "./piCatalog";
import { registerHarness, type HarnessAdapter } from "./registry";

export const piAdapter: HarnessAdapter = {
  id: "pi",
  live: true,
  sendTurn: sendPiTurn,
  steerTurn: steerPiTurn,
  cancelTurn: cancelPiTurn,
  respondApproval: respondPiApproval,
  stopSession: stopPiSession,
  forgetSession: forgetPiSession,
  bindSession: bindPiSession,
  refreshCatalog: refreshPiCatalog,
};

let registered = false;

export function ensurePiRegistered(): void {
  if (registered) return;
  registerHarness(piAdapter);
  registered = true;
}
