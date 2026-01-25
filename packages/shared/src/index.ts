export type SessionStatus =
  | "ai_active"
  | "awaiting_approval"
  | "awaiting_instruction"
  | "stopped";

export type TerminalType = "iterm" | "cursor" | "vscode" | "terminal" | "unknown";

export interface BaseSession {
  id: string;
  iterm_session_id: string | null;
  terminal_type: TerminalType;
  session_name: string | null;
  project_path: string | null;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Session extends BaseSession {
  ai_active_ms: number | null;
  awaiting_approval_ms: number | null;
  awaiting_instruction_ms: number | null;
}

export interface Event {
  id: number;
  session_id: string;
  event_type: string;
  tool_name: string | null;
  payload: string | null;
  created_at: string;
}

export interface TimeTracking {
  id: number;
  session_id: string;
  tracking_type: "ai_active" | "awaiting_approval" | "awaiting_instruction";
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
}

export interface WebSocketMessage {
  type: "session_updated" | "event_received";
  session?: Session;
  event?: {
    session_id: string;
    event_type: string;
    tool_name?: string;
  };
}

// Utility functions
export function formatDuration(ms: number | null): string {
  if (!ms) return "0s";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
