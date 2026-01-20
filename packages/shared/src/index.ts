export type SessionStatus =
  | "ai_active"
  | "awaiting_approval"
  | "awaiting_instruction"
  | "stopped";

export interface BaseSession {
  id: string;
  iterm_session_id: string | null;
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
