import { formatDuration } from "@agent-monitor/shared";
import type { Session } from "@agent-monitor/shared";
import "./Dashboard.css";

interface DashboardProps {
  sessions: Session[];
}

export function Dashboard({ sessions }: DashboardProps) {
  const totalAiActive = sessions.reduce(
    (sum, s) => sum + (s.ai_active_ms || 0),
    0
  );
  const totalAwaitingApproval = sessions.reduce(
    (sum, s) => sum + (s.awaiting_approval_ms || 0),
    0
  );
  const totalAwaitingInstruction = sessions.reduce(
    (sum, s) => sum + (s.awaiting_instruction_ms || 0),
    0
  );
  const totalTime =
    totalAiActive + totalAwaitingApproval + totalAwaitingInstruction;

  const aiActivePercent = totalTime > 0 ? (totalAiActive / totalTime) * 100 : 0;
  const awaitingApprovalPercent =
    totalTime > 0 ? (totalAwaitingApproval / totalTime) * 100 : 0;
  const awaitingInstructionPercent =
    totalTime > 0 ? (totalAwaitingInstruction / totalTime) * 100 : 0;

  const statusCounts = {
    ai_active: sessions.filter((s) => s.status === "ai_active").length,
    awaiting_approval: sessions.filter((s) => s.status === "awaiting_approval")
      .length,
    awaiting_instruction: sessions.filter(
      (s) => s.status === "awaiting_instruction"
    ).length,
  };

  return (
    <div className="dashboard">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--status-active)" }}>
            {statusCounts.ai_active}
          </div>
          <div className="stat-label">AI Active</div>
        </div>
        <div className="stat-card">
          <div
            className="stat-value"
            style={{ color: "var(--status-approval)" }}
          >
            {statusCounts.awaiting_approval}
          </div>
          <div className="stat-label">Awaiting Approval</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--status-waiting)" }}>
            {statusCounts.awaiting_instruction}
          </div>
          <div className="stat-label">Awaiting Instruction</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{sessions.length}</div>
          <div className="stat-label">Total Sessions</div>
        </div>
      </div>

      {totalTime > 0 && (
        <div className="time-summary">
          <h3>Time Distribution</h3>
          <div className="progress-bar">
            <div
              className="progress-segment ai-active"
              style={{ width: `${aiActivePercent}%` }}
              title={`AI Active: ${formatDuration(totalAiActive)}`}
            />
            <div
              className="progress-segment awaiting-approval"
              style={{ width: `${awaitingApprovalPercent}%` }}
              title={`Awaiting Approval: ${formatDuration(totalAwaitingApproval)}`}
            />
            <div
              className="progress-segment awaiting-instruction"
              style={{ width: `${awaitingInstructionPercent}%` }}
              title={`Awaiting Instruction: ${formatDuration(totalAwaitingInstruction)}`}
            />
          </div>
          <div className="time-legend">
            <div className="legend-item">
              <span
                className="legend-dot"
                style={{ backgroundColor: "var(--status-active)" }}
              />
              <span>AI Active: {formatDuration(totalAiActive)}</span>
            </div>
            <div className="legend-item">
              <span
                className="legend-dot"
                style={{ backgroundColor: "var(--status-approval)" }}
              />
              <span>Awaiting Approval: {formatDuration(totalAwaitingApproval)}</span>
            </div>
            <div className="legend-item">
              <span
                className="legend-dot"
                style={{ backgroundColor: "var(--status-waiting)" }}
              />
              <span>
                Awaiting Instruction: {formatDuration(totalAwaitingInstruction)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
