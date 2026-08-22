import { writeChild } from "./child";
import { parseJsonLine, parseRpcResponse, stringField } from "./piProtocol";

type Pending = {
  resolve: (value: Record<string, unknown>) => void;
  reject: (error: Error) => void;
};

/**
 * JSONL request/response multiplexer for `pi --mode rpc`.
 * Agent events and extension UI frames are forwarded to `onFrame`.
 */
export class PiRpc {
  private nextId = 1;
  private readonly pending = new Map<string, Pending>();
  private closed = false;

  constructor(
    private readonly sessionId: string,
    private readonly onFrame: (rec: Record<string, unknown>) => void,
  ) {}

  pushLine(line: string) {
    const rec = parseJsonLine(line);
    if (!rec) return;
    const response = parseRpcResponse(rec);
    if (response?.id && this.pending.has(response.id)) {
      const pending = this.pending.get(response.id);
      this.pending.delete(response.id);
      if (!pending) return;
      if (!response.success) {
        pending.reject(new Error(response.error || `Pi ${response.command} failed`));
        return;
      }
      pending.resolve(rec);
      return;
    }
    this.onFrame(rec);
  }

  async request(
    command: Record<string, unknown>,
    timeoutMs = 15_000,
  ): Promise<Record<string, unknown>> {
    if (this.closed) throw new Error("Pi process is not running");
    const id = `mc_${this.nextId++}`;
    const payload = { ...command, id };
    const pending = new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        const type = stringField(command, "type") ?? "command";
        reject(new Error(`Pi ${type} timed out`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
    });
    await writeChild(this.sessionId, JSON.stringify(payload));
    return pending;
  }

  close(error?: Error) {
    if (this.closed) return;
    this.closed = true;
    const err = error ?? new Error("Pi process exited");
    for (const pending of this.pending.values()) pending.reject(err);
    this.pending.clear();
  }
}
