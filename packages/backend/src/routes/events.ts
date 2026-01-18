import { Hono } from "hono";
import { execSync } from "child_process";
import type Database from "better-sqlite3";
import type { Session } from "../db.js";

export function eventsRouter(
  db: Database.Database,
  broadcast: (data: object) => void
) {
  const router = new Hono();

  // Record event from hook
  router.post("/", async (c) => {
    const body = await c.req.json<{
      session_id: string;
      event_type: string;
      tool_name?: string;
      payload?: object;
      iterm_session_id?: string;
      project_path?: string;
    }>();

    // Ensure session exists
    let session = db
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .get(body.session_id) as Session | undefined;

    if (!session) {
      db.prepare(
        `
        INSERT INTO sessions (id, iterm_session_id, project_path, status, started_at)
        VALUES (?, ?, ?, 'ai_active', datetime('now'))
      `
      ).run(body.session_id, body.iterm_session_id, body.project_path);

      session = db
        .prepare("SELECT * FROM sessions WHERE id = ?")
        .get(body.session_id) as Session;
    }

    // Insert event
    db.prepare(
      `
      INSERT INTO events (session_id, event_type, tool_name, payload)
      VALUES (?, ?, ?, ?)
    `
    ).run(
      body.session_id,
      body.event_type,
      body.tool_name,
      body.payload ? JSON.stringify(body.payload) : null
    );

    // Determine new status based on event type
    let newStatus = session.status;
    let shouldNotify = false;

    switch (body.event_type) {
      case "PreToolUse":
        newStatus = "ai_active";
        break;
      case "PostToolUse":
        newStatus = "ai_active";
        break;
      case "Notification":
        newStatus = "awaiting_approval";
        shouldNotify = true;
        break;
      case "Stop":
        newStatus = "awaiting_instruction";
        break;
    }

    // Update session status if changed
    if (newStatus !== session.status) {
      // End current time tracking
      db.prepare(
        `
        UPDATE time_tracking
        SET ended_at = datetime('now'),
            duration_ms = (strftime('%s', 'now') - strftime('%s', started_at)) * 1000
        WHERE session_id = ? AND ended_at IS NULL
      `
      ).run(body.session_id);

      // Start new time tracking
      db.prepare(
        `
        INSERT INTO time_tracking (session_id, tracking_type, started_at)
        VALUES (?, ?, datetime('now'))
      `
      ).run(body.session_id, newStatus);

      // Update session
      db.prepare(
        `
        UPDATE sessions
        SET status = ?, updated_at = datetime('now')
        WHERE id = ?
      `
      ).run(newStatus, body.session_id);
    } else {
      // Just update timestamp
      db.prepare(
        `
        UPDATE sessions SET updated_at = datetime('now') WHERE id = ?
      `
      ).run(body.session_id);
    }

    // Get updated session
    const updatedSession = db
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
      .get(body.session_id);

    broadcast({
      type: "event_received",
      event: body,
      session: updatedSession,
    });

    // Send macOS notification if awaiting approval
    if (shouldNotify) {
      try {
        const projectName = body.project_path?.split("/").pop() || "Unknown";
        execSync(
          `osascript -e 'display notification "Session requires approval" with title "Agent Monitor" subtitle "${projectName}"'`
        );
      } catch {
        // Ignore notification errors
      }
    }

    return c.json({ success: true, session: updatedSession });
  });

  // Get events for a session
  router.get("/:sessionId", (c) => {
    const { sessionId } = c.req.param();
    const limit = Number(c.req.query("limit")) || 100;

    const events = db
      .prepare(
        `
      SELECT * FROM events
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `
      )
      .all(sessionId, limit);

    return c.json(events);
  });

  return router;
}
