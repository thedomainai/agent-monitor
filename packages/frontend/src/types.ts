export type SessionStatus =
  | "ai_active"
  | "awaiting_approval"
  | "awaiting_instruction"
  | "stopped";

export interface Session {
  id: string;
  iterm_session_id: string | null;
  project_path: string | null;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
  ai_active_ms: number | null;
  awaiting_approval_ms: number | null;
  awaiting_instruction_ms: number | null;
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
