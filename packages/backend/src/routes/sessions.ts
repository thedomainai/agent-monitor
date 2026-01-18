import { Hono } from "hono";
import type Database from "better-sqlite3";
import type { Session, SessionStatus } from "../db.js";

export function sessionsRouter(
  db: Database.Database,
  broadcast: (data: object) => void
) {
  const router = new Hono();

  // Get all active sessions
  router.get("/", (c) => {
    const sessions = db
      .prepare(
        `
      SELECT
        s.*,
        (SELECT SUM(duration_ms) FROM time_tracking WHERE session_id = s.id AND tracking_type = 'ai_active') as ai_active_ms,
        (SELECT SUM(duration_ms) FROM time_tracking WHERE session_id = s.id AND tracking_type = 'awaiting_approval') as awaiting_approval_ms,
        (SELECT SUM(duration_ms) FROM time_tracking WHERE session_id = s.id AND tracking_type = 'awaiting_instruction') as awaiting_instruction_ms
      FROM sessions s
      WHERE s.status != 'stopped'
      ORDER BY s.updated_at DESC
    `
      )
      .all();
    return c.json(sessions);
  });

  // Get session by ID
  router.get("/:id", (c) => {
    const { id } = c.req.param();
    const session = db
      .prepare(
        `
      SELECT
        s.*,
        (SELECT SUM(duration_ms) FROM time_tracking WHERE session_id = s.id AND tracking_type = 'ai_active') as ai_active_ms,
        (SELECT SUM(duration_ms) FROM time_tracking WHERE session_id = s.id AND tracking_type = 'awaiting_approval') as awaiting_approval_ms,
        (SELECT SUM(duration_ms) FROM time_tracking WHERE session_id = s.id AND tracking_type = 'awaiting_instruction') as awaiting_instruction_ms
      FROM sessions s
      WHERE s.id = ?
    `
      )
      .get(id);

    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }
    return c.json(session);
  });

  // Create or update session
  router.post("/", async (c) => {
    const body = await c.req.json<{
      session_id: string;
      iterm_session_id?: string;
      project_path?: string;
    }>();

    const existing = db
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .get(body.session_id) as Session | undefined;

    if (existing) {
      db.prepare(
        `
        UPDATE sessions
        SET iterm_session_id = COALESCE(?, iterm_session_id),
            project_path = COALESCE(?, project_path),
            updated_at = datetime('now')
        WHERE id = ?
      `
      ).run(body.iterm_session_id, body.project_path, body.session_id);
    } else {
      db.prepare(
        `
        INSERT INTO sessions (id, iterm_session_id, project_path, status, started_at)
        VALUES (?, ?, ?, 'ai_active', datetime('now'))
      `
      ).run(body.session_id, body.iterm_session_id, body.project_path);
    }

    const session = db
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .get(body.session_id);

    broadcast({ type: "session_updated", session });

    return c.json(session);
  });

  // Update session status
  router.patch("/:id/status", async (c) => {
    const { id } = c.req.param();
    const { status } = await c.req.json<{ status: SessionStatus }>();

    const session = db
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .get(id) as Session | undefined;

    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }

    // End current time tracking
    db.prepare(
      `
      UPDATE time_tracking
      SET ended_at = datetime('now'),
          duration_ms = (strftime('%s', 'now') - strftime('%s', started_at)) * 1000
      WHERE session_id = ? AND ended_at IS NULL
    `
    ).run(id);

    // Start new time tracking if not stopped
    if (status !== "stopped") {
      db.prepare(
        `
        INSERT INTO time_tracking (session_id, tracking_type, started_at)
        VALUES (?, ?, datetime('now'))
      `
      ).run(id, status);
    }

    // Update session status
    const updateData =
      status === "stopped"
        ? db.prepare(
            `
          UPDATE sessions
          SET status = ?, ended_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ?
        `
          )
        : db.prepare(
            `
          UPDATE sessions
          SET status = ?, updated_at = datetime('now')
          WHERE id = ?
        `
          );

    updateData.run(status, id);

    const updatedSession = db
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .get(id);

    broadcast({ type: "session_updated", session: updatedSession });

    return c.json(updatedSession);
  });

  // Get session history
  router.get("/history/all", (c) => {
    const limit = Number(c.req.query("limit")) || 50;
    const sessions = db
      .prepare(
        `
      SELECT
        s.*,
        (SELECT SUM(duration_ms) FROM time_tracking WHERE session_id = s.id AND tracking_type = 'ai_active') as ai_active_ms,
        (SELECT SUM(duration_ms) FROM time_tracking WHERE session_id = s.id AND tracking_type = 'awaiting_approval') as awaiting_approval_ms,
        (SELECT SUM(duration_ms) FROM time_tracking WHERE session_id = s.id AND tracking_type = 'awaiting_instruction') as awaiting_instruction_ms
      FROM sessions s
      ORDER BY s.created_at DESC
      LIMIT ?
    `
      )
      .all(limit);
    return c.json(sessions);
  });

  return router;
}
