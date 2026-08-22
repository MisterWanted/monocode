import { homeDir } from "../fs";
import { setHarnessModels } from "../models";
import {
  killChild,
  resolvePiBinary,
  spawnChild,
  unwatchChild,
  watchChild,
} from "./child";
import { PiRpc } from "./piClient";
import { buildPiSpawnArgs, modelsFromRpcData } from "./piProtocol";

const PROBE_ID = "monocode-pi-probe";
const DISCOVERY_TIMEOUT_MS = 45_000;

let inflight: Promise<void> | null = null;

export function refreshPiCatalog(): Promise<void> {
  if (inflight) return inflight;
  inflight = discoverPiModels()
    .then((models) => {
      if (models.length > 0) setHarnessModels("pi", models);
    })
    .catch((error: unknown) => {
      console.debug("[monocode] pi catalog", error);
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

async function discoverPiModels() {
  const { path } = await resolvePiBinary();
  const cwd = await homeDir();
  const rpc = new PiRpc(PROBE_ID, () => undefined);

  const stop = () => {
    rpc.close();
    unwatchChild(PROBE_ID);
    void killChild(PROBE_ID).catch(() => undefined);
  };

  watchChild(
    PROBE_ID,
    (line) => rpc.pushLine(line),
    () => rpc.close(new Error("Pi catalog probe exited")),
  );

  try {
    await spawnChild(
      PROBE_ID,
      path,
      buildPiSpawnArgs({ noSession: true }),
      cwd,
    );
    const response = await Promise.race([
      rpc.request({ type: "get_available_models" }, DISCOVERY_TIMEOUT_MS),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Pi model discovery timed out")),
          DISCOVERY_TIMEOUT_MS,
        );
      }),
    ]);
    return modelsFromRpcData(response.data);
  } finally {
    stop();
  }
}
