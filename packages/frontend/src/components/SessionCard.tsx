import { useEffect, useState } from "react";
import { formatDuration } from "@agent-monitor/shared";
import type { Session, SessionStatus } from "@agent-monitor/shared";
import "./SessionCard.css";

interface SessionCardProps {
  session: Session;
  onFocus: (session: Session) => void;
}

const STATUS_CONFIG: Record<
  SessionStatus,
  { label: string; color: string; bgColor: string }
> = {
  ai_active: {
    label: "AI Active",
    color: "var(--status-active)",
    bgColor: "rgba(63, 185, 80, 0.15)",
  },
  awaiting_approval: {
    label: "Awaiting Approval",
    color: "var(--status-approval)",
    bgColor: "rgba(240, 136, 62, 0.15)",
  },
  awaiting_instruction: {
    label: "Awaiting Instruction",
    color: "var(--status-waiting)",
    bgColor: "rgba(139, 148, 158, 0.15)",
  },
  stopped: {
    label: "Stopped",
    color: "var(--status-stopped)",
    bgColor: "rgba(248, 81, 73, 0.15)",
  },
};

function getDisplayName(session: Session): string {
  if (session.session_name) {
    return session.session_name;
  }
  if (session.project_path) {
    const parts = session.project_path.split("/");
    return parts[parts.length - 1] || session.project_path;
  }
  return "Unknown Session";
}

export function SessionCard({ session, onFocus }: SessionCardProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (session.status === "stopped") return;
    
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [session.status]);

  const statusConfig = STATUS_CONFIG[session.status];
  
  // Calculate current session's live duration
  const updatedAt = new Date(session.updated_at).getTime();
  const liveMs = session.status !== "stopped" ? now - updatedAt : 0;

  const aiActiveTime = (session.ai_active_ms || 0) + (session.status === "ai_active" ? liveMs : 0);
  const awaitingApprovalTime = (session.awaiting_approval_ms || 0) + (session.status === "awaiting_approval" ? liveMs : 0);
  const awaitingInstructionTime = (session.awaiting_instruction_ms || 0) + (session.status === "awaiting_instruction" ? liveMs : 0);
  
  const totalTime = aiActiveTime + awaitingApprovalTime + awaitingInstructionTime;

  // Can focus if:
  // - iTerm with valid session ID
  // - Cursor/VSCode/unknown with valid project path (will try to open in Cursor)
  const canFocus = session.terminal_type === "iterm"
    ? session.iterm_session_id !== null
    : session.project_path !== null;

  const handleCardClick = () => {
    if (canFocus) {
      onFocus(session);
    }
  };

  return (
    <div
      className={`session-card ${canFocus ? 'clickable' : ''}`}
      onClick={handleCardClick}
      role={canFocus ? "button" : undefined}
      tabIndex={canFocus ? 0 : undefined}
      onKeyDown={(e) => {
        if (canFocus && (e.key === 'Enter' || e.key === ' ')) {
          handleCardClick();
        }
      }}
    >
      <div className="card-header">
        <h3 className="project-name">{getDisplayName(session)}</h3>
        <span
          className="status-badge"
          style={{
            color: statusConfig.color,
            backgroundColor: statusConfig.bgColor,
          }}
        >
          {statusConfig.label}
        </span>
      </div>

      <div className="time-breakdown">
        <div className="time-item">
          <span className="time-label">AI Active</span>
          <span className="time-value" style={{ color: "var(--status-active)" }}>
            {formatDuration(aiActiveTime)}
          </span>
        </div>
        <div className="time-item">
          <span className="time-label">Awaiting Approval</span>
          <span
            className="time-value"
            style={{ color: "var(--status-approval)" }}
          >
            {formatDuration(awaitingApprovalTime)}
          </span>
        </div>
        <div className="time-item">
          <span className="time-label">Awaiting Instruction</span>
          <span
            className="time-value"
            style={{ color: "var(--status-waiting)" }}
          >
            {formatDuration(awaitingInstructionTime)}
          </span>
        </div>
        <div className="time-item total">
          <span className="time-label">Total</span>
          <span className="time-value">{formatDuration(totalTime)}</span>
        </div>
      </div>

      <div className="card-footer">
        <span className="session-id" title={session.id}>
          {session.id.slice(0, 8)}...
        </span>
        <span className="terminal-type">
          {session.terminal_type === "cursor" ? "Cursor" :
           session.terminal_type === "iterm" ? "iTerm" :
           session.terminal_type === "terminal" ? "Terminal" : "Unknown"}
        </span>
      </div>
    </div>
  );
}
