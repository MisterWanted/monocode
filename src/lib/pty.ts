import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

type DataPayload = { id: string; data: string };
type ExitPayload = { id: string; code: number | null };

type DataHandler = (data: Uint8Array) => void;
type ExitHandler = (code: number | null) => void;

const dataHandlers = new Map<string, DataHandler>();
const exitHandlers = new Map<string, ExitHandler>();
const dataBuffer = new Map<string, Uint8Array[]>();

const MAX_BUFFERED = 200;
let bridge: Promise<UnlistenFn[]> | null = null;
let users = 0;
let teardownTimer: ReturnType<typeof setTimeout> | undefined;

function decodeBase64(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function pushBuffered(id: string, chunk: Uint8Array) {
  const queued = dataBuffer.get(id) ?? [];
  queued.push(chunk);
  if (queued.length > MAX_BUFFERED) {
    queued.splice(0, queued.length - MAX_BUFFERED);
  }
  dataBuffer.set(id, queued);
}

function ensureBridge() {
  if (bridge) return;
  bridge = Promise.all([
    listen<DataPayload>("pty-data", (event) => {
      const { id, data } = event.payload;
      const chunk = decodeBase64(data);
      const handler = dataHandlers.get(id);
      if (handler) handler(chunk);
      else pushBuffered(id, chunk);
    }),
    listen<ExitPayload>("pty-exit", (event) => {
      const { id, code } = event.payload;
      exitHandlers.get(id)?.(code);
    }),
  ]);
}

function retain() {
  users += 1;
  if (teardownTimer) {
    clearTimeout(teardownTimer);
    teardownTimer = undefined;
  }
  ensureBridge();
}

function release() {
  users = Math.max(0, users - 1);
  if (users > 0 || !bridge) return;
  const pending = bridge;
  teardownTimer = setTimeout(() => {
    teardownTimer = undefined;
    if (users > 0) return;
    bridge = null;
    void pending.then((fns) => fns.forEach((fn) => fn()));
  }, 500);
}

export async function spawnPty(
  id: string,
  cwd: string,
  cols: number,
  rows: number,
): Promise<void> {
  await invoke("pty_spawn", { id, cwd, cols, rows });
}

export async function writePty(id: string, data: string): Promise<void> {
  await invoke("pty_write", { id, data });
}

export async function resizePty(
  id: string,
  cols: number,
  rows: number,
): Promise<void> {
  await invoke("pty_resize", { id, cols, rows });
}

export async function getPtyStatus(
  id: string,
): Promise<{ foreground: string | null }> {
  return invoke<{ foreground: string | null }>("pty_status", { id });
}

export async function killPty(id: string): Promise<void> {
  dataHandlers.delete(id);
  exitHandlers.delete(id);
  dataBuffer.delete(id);
  await invoke("pty_kill", { id }).catch(() => undefined);
}

export async function killAllPtys(): Promise<void> {
  dataHandlers.clear();
  exitHandlers.clear();
  dataBuffer.clear();
  await invoke("pty_kill_all").catch(() => undefined);
}

export function subscribePty(
  id: string,
  onData: DataHandler,
  onExit: ExitHandler,
): () => void {
  retain();
  dataHandlers.set(id, onData);
  exitHandlers.set(id, onExit);
  const queued = dataBuffer.get(id);
  if (queued) {
    dataBuffer.delete(id);
    for (const chunk of queued) onData(chunk);
  }
  return () => {
    if (dataHandlers.get(id) === onData) dataHandlers.delete(id);
    if (exitHandlers.get(id) === onExit) exitHandlers.delete(id);
    release();
  };
}
