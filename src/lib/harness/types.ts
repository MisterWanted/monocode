import type { Attachment, RuntimeMode, ToolPreview } from "../session";

export type HarnessEvent =
  | { type: "session.started" }
  | { type: "session.ended"; code?: number | null }
  | { type: "session.error"; message: string }
  | { type: "session.providerBound"; providerSessionId: string }
  | { type: "status"; text: string }
  | { type: "message.delta"; text: string }
  | { type: "message.completed" }
  | { type: "reasoning.delta"; text: string }
  | { type: "reasoning.completed" }
  | {
      type: "tool.started";
      callId: string;
      title: string;
      kind?: string;
      status?: string;
      preview?: ToolPreview;
    }
  | {
      type: "tool.updated";
      callId: string;
      title?: string;
      kind?: string;
      status?: string;
      detail?: string;
      preview?: ToolPreview;
    }
  | {
      type: "approval.requested";
      requestId: number;
      title: string;
      kind?: string;
      callId?: string;
      preview?: ToolPreview;
    }
  | {
      type: "approval.resolved";
      requestId: number;
      decision: "allow" | "deny";
    }
  | { type: "plan"; text: string };

export type ApprovalDecision = "allow" | "deny";

export type SendTurnInput = {
  sessionId: string;
  cwd: string;
  model: string;
  modelSettings?: Record<string, string>;
  runtimeMode: RuntimeMode;
  text: string;
  attachments?: Attachment[];
  onEvent: (event: HarnessEvent) => void;
};

export type SteerTurnInput = {
  sessionId: string;
  cwd: string;
  model: string;
  modelSettings?: Record<string, string>;
  text: string;
  attachments?: Attachment[];
};
