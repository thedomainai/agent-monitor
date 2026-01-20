import type { Session, SessionStatus } from "@agent-monitor/shared";

interface SessionCardProps {
  session: Session;
  onFocus: (itermSessionId: string) => void;
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

function formatDuration(ms: number | null): string {
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

function getDisplayName(session: Session): string {
  // Prefer session_name (iTerm2 tab name), fallback to project path
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
  const statusConfig = STATUS_CONFIG[session.status];
  const totalTime =
    (session.ai_active_ms || 0) +
    (session.awaiting_approval_ms || 0) +
    (session.awaiting_instruction_ms || 0);

  const canFocus = session.iterm_session_id !== null;

  return (
    <div className="session-card">
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
            {formatDuration(session.ai_active_ms)}
          </span>
        </div>
        <div className="time-item">
          <span className="time-label">Awaiting Approval</span>
          <span
            className="time-value"
            style={{ color: "var(--status-approval)" }}
          >
            {formatDuration(session.awaiting_approval_ms)}
          </span>
        </div>
        <div className="time-item">
          <span className="time-label">Awaiting Instruction</span>
          <span
            className="time-value"
            style={{ color: "var(--status-waiting)" }}
          >
            {formatDuration(session.awaiting_instruction_ms)}
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
        {canFocus && (
          <button
            className="focus-button"
            onClick={() => onFocus(session.iterm_session_id!)}
          >
            Focus Tab
          </button>
        )}
      </div>

      <style>{`
        .session-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 16px;
          transition: border-color 0.2s;
        }

        .session-card:hover {
          border-color: var(--text-secondary);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .project-name {
          font-size: 16px;
          font-weight: 600;
          word-break: break-word;
        }

        .status-badge {
          font-size: 12px;
          font-weight: 500;
          padding: 4px 8px;
          border-radius: 4px;
          white-space: nowrap;
        }

        .time-breakdown {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 16px;
        }

        .time-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .time-item.total {
          grid-column: span 2;
          padding-top: 8px;
          border-top: 1px solid var(--border-color);
        }

        .time-label {
          font-size: 12px;
          color: var(--text-secondary);
        }

        .time-value {
          font-size: 14px;
          font-weight: 500;
        }

        .card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .session-id {
          font-size: 12px;
          color: var(--text-secondary);
          font-family: monospace;
        }

        .focus-button {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .focus-button:hover {
          background: var(--border-color);
        }
      `}</style>
    </div>
  );
}
