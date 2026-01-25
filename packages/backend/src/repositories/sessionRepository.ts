import type { Database } from "better-sqlite3";
import type { Session, BaseSession, SessionStatus, Event } from "@agent-monitor/shared";

// Reusable SQL fragment for time tracking aggregation
const TIME_TRACKING_COLUMNS = `
  (SELECT SUM(duration_ms) FROM time_tracking WHERE session_id = s.id AND tracking_type = 'ai_active') as ai_active_ms,
  (SELECT SUM(duration_ms) FROM time_tracking WHERE session_id = s.id AND tracking_type = 'awaiting_approval') as awaiting_approval_ms,
  (SELECT SUM(duration_ms) FROM time_tracking WHERE session_id = s.id AND tracking_type = 'awaiting_instruction') as awaiting_instruction_ms
`;

export class SessionRepository {
  constructor(private db: Database) {}

  findAll(limit: number = 100): Session[] {
    return this.db
      .prepare(
        `
      SELECT s.*, ${TIME_TRACKING_COLUMNS}
      FROM sessions s
      WHERE s.status != 'stopped'
      ORDER BY s.updated_at DESC
      LIMIT ?
    `
      )
      .all(limit) as Session[];
  }

  findById(id: string): Session | undefined {
    return this.db
      .prepare(
        `
      SELECT s.*, ${TIME_TRACKING_COLUMNS}
      FROM sessions s
      WHERE s.id = ?
    `
      )
      .get(id) as Session | undefined;
  }

  findHistory(limit: number = 50): Session[] {
     return this.db
      .prepare(
        `
      SELECT s.*, ${TIME_TRACKING_COLUMNS}
      FROM sessions s
      ORDER BY s.created_at DESC
      LIMIT ?
    `
      )
      .all(limit) as Session[];
  }

  create(session: Partial<BaseSession> & { id: string }): void {
    this.db.prepare(
        `
        INSERT INTO sessions (id, iterm_session_id, terminal_type, session_name, project_path, status, started_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `
      ).run(
        session.id,
        session.iterm_session_id || null,
        session.terminal_type || 'unknown',
        session.session_name || null,
        session.project_path || null,
        session.status || 'ai_active'
      );
  }

  update(id: string, updates: Partial<BaseSession>): void {
    this.db.prepare(
        `
        UPDATE sessions
        SET iterm_session_id = COALESCE(?, iterm_session_id),
            session_name = COALESCE(?, session_name),
            project_path = COALESCE(?, project_path),
            updated_at = datetime('now')
        WHERE id = ?
      `
      ).run(
        updates.iterm_session_id, 
        updates.session_name, 
        updates.project_path, 
        id
      );
  }

  updateStatus(id: string, status: SessionStatus): void {
      const updateData = status === "stopped"
        ? this.db.prepare(
            `
          UPDATE sessions
          SET status = ?, ended_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ?
        `
          )
        : this.db.prepare(
            `
          UPDATE sessions
          SET status = ?, updated_at = datetime('now')
          WHERE id = ?
        `
          );

    updateData.run(status, id);
  }
  
  startTimeTracking(sessionId: string, type: string): void {
    this.db.prepare(
        `
        INSERT INTO time_tracking (session_id, tracking_type, started_at)
        VALUES (?, ?, datetime('now'))
      `
      ).run(sessionId, type);
  }

  endTimeTracking(sessionId: string): void {
    this.db.prepare(
      `
      UPDATE time_tracking
      SET ended_at = datetime('now'),
          duration_ms = (strftime('%s', 'now') - strftime('%s', started_at)) * 1000
      WHERE session_id = ? AND ended_at IS NULL
    `
    ).run(sessionId);
  }
  
  createEvent(event: Omit<Event, 'id' | 'created_at'>): void {
      this.db.prepare(
      `
      INSERT INTO events (session_id, event_type, tool_name, payload)
      VALUES (?, ?, ?, ?)
    `
    ).run(
      event.session_id,
      event.event_type,
      event.tool_name,
      event.payload
    );
  }
  
  findEvents(sessionId: string, limit: number = 100): Event[] {
      return this.db
      .prepare(
        `
      SELECT * FROM events
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `
      )
      .all(sessionId, limit) as Event[];
  }
}
