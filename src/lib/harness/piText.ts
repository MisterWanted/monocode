import { modelsFor } from "../models";
import {
  killChild,
  resolvePiBinary,
  spawnChild,
  unwatchChild,
  watchChild,
} from "./child";
import { PiRpc } from "./piClient";
import {
  agentEndWillRetry,
  asRecord,
  assistantDeltaFromEvent,
  buildPiPrompt,
  buildPiSpawnArgs,
  isAgentSettled,
} from "./piProtocol";
import { mergeStream } from "./streamText";

const TEXT_CHILD_ID = "monocode-pi-text";
const INIT_TIMEOUT_MS = 15_000;
const REQUEST_TIMEOUT_MS = 45_000;

type LiveText = {
  rpc: PiRpc;
  cwd: string;
  collecting: boolean;
  output: string;
  closed: boolean;
  turnDone: (() => void) | null;
  turnFailed: ((error: Error) => void) | null;
  turnEndPending: boolean;
};

let live: LiveText | null = null;
let turns: Promise<void> = Promise.resolve();

function pickTextModel(): string | undefined {
  const models = modelsFor("pi").filter((model) =>
    Boolean(model.nativeId?.includes("/")),
  );
  const cheap = models.find((model) =>
    /haiku|mini|flash|nano|lite|luna/i.test(
      `${model.nativeId ?? ""} ${model.name} ${model.id}`,
    ),
  );
  return (cheap ?? models[0])?.nativeId?.trim() || undefined;
}

export async function stopPiTextPrompt(): Promise<void> {
  await dropLive();
}

export function warmupPiText(cwd: string): Promise<void> {
  if (!cwd || cwd === "~") return Promise.resolve();
  const run = turns.catch(() => undefined).then(async () => {
    await ensureLive(cwd);
  });
  turns = run.then(
    () => undefined,
    () => undefined,
  );
  return run.catch(() => undefined);
}

export async function runPiTextPrompt(input: {
  cwd: string;
  prompt: string;
  timeoutMs?: number;
}): Promise<string> {
  const run = turns.catch(() => undefined).then(() => promptOnLive(input));
  turns = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function promptOnLive(input: {
  cwd: string;
  prompt: string;
  timeoutMs?: number;
}): Promise<string> {
  const session = await ensureLive(input.cwd);
  const timeoutMs = input.timeoutMs ?? REQUEST_TIMEOUT_MS;

  try {
    await session.rpc.request({ type: "new_session" }).catch(() => undefined);
    await session.rpc
      .request({ type: "set_thinking_level", level: "off" })
      .catch(() => undefined);

    session.output = "";
    session.collecting = true;
    session.turnEndPending = false;

    const turnPromise = new Promise<void>((resolve, reject) => {
      session.turnDone = resolve;
      session.turnFailed = reject;
    });

    await session.rpc.request(buildPiPrompt({ text: input.prompt }), timeoutMs);
    if (session.turnEndPending) finishTurn(session);

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        turnPromise,
        new Promise<void>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Pi text generation timed out")),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }

    let output = session.output.trim();
    if (!output) {
      const rec = await session.rpc
        .request({ type: "get_last_assistant_text" })
        .catch(() => null);
      const text = asRecord(rec?.data)?.text;
      if (typeof text === "string") output = text.trim();
    }
    if (!output) throw new Error("Pi returned empty output.");
    return output;
  } catch (error) {
    session.turnDone = null;
    session.turnFailed = null;
    await session.rpc.request({ type: "abort" }).catch(() => undefined);
    await dropLive();
    throw error;
  } finally {
    session.collecting = false;
    session.turnDone = null;
    session.turnFailed = null;
  }
}

async function ensureLive(cwd: string): Promise<LiveText> {
  if (live && !live.closed && live.cwd === cwd) return live;
  await dropLive();
  return startLive(cwd);
}

async function startLive(cwd: string): Promise<LiveText> {
  const { path } = await resolvePiBinary();
  const liveRef: { current: LiveText | null } = { current: null };
  const rpc = new PiRpc(TEXT_CHILD_ID, (rec) => {
    const current = liveRef.current;
    if (current) handleFrame(current, rec);
  });
  const session: LiveText = {
    rpc,
    cwd,
    collecting: false,
    output: "",
    closed: false,
    turnDone: null,
    turnFailed: null,
    turnEndPending: false,
  };
  liveRef.current = session;

  watchChild(
    TEXT_CHILD_ID,
    (line) => rpc.pushLine(line),
    () => {
      session.closed = true;
      if (live === session) live = null;
      rpc.close(new Error("Pi text generator exited"));
      session.turnFailed?.(new Error("Pi text generator exited"));
      session.turnDone = null;
      session.turnFailed = null;
    },
  );

  try {
    await spawnChild(
      TEXT_CHILD_ID,
      path,
      buildPiSpawnArgs({
        isolated: true,
        model: pickTextModel(),
      }),
      cwd,
    );
    await rpc.request({ type: "get_state" }, INIT_TIMEOUT_MS);
    live = session;
    return session;
  } catch (error) {
    session.closed = true;
    rpc.close(error instanceof Error ? error : new Error(String(error)));
    unwatchChild(TEXT_CHILD_ID);
    await killChild(TEXT_CHILD_ID).catch(() => undefined);
    throw error;
  }
}

async function dropLive(): Promise<void> {
  const current = live;
  live = null;
  if (current) {
    current.closed = true;
    current.rpc.close();
    current.turnFailed?.(new Error("Pi text generator stopped"));
    current.turnDone = null;
    current.turnFailed = null;
  }
  unwatchChild(TEXT_CHILD_ID);
  await killChild(TEXT_CHILD_ID).catch(() => undefined);
}

function handleFrame(session: LiveText, rec: Record<string, unknown>) {
  if (!session.collecting) return;
  const delta = assistantDeltaFromEvent(rec);
  if (delta?.kind === "text") {
    session.output = mergeStream(session.output, delta.text);
  }
  if (isAgentSettled(rec) || agentEndWillRetry(rec) === false) {
    if (session.turnDone) finishTurn(session);
    else session.turnEndPending = true;
  }
}

function finishTurn(session: LiveText) {
  session.turnEndPending = false;
  const done = session.turnDone;
  session.turnDone = null;
  session.turnFailed = null;
  done?.();
}
