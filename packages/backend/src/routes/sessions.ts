import { Hono } from "hono";
import type { SessionService } from "../services/sessionService.js";
import type { SessionStatus } from "@agent-monitor/shared";

export function sessionsRouter(sessionService: SessionService) {
  const router = new Hono();

  // Get all active sessions
  router.get("/", (c) => {
    const sessions = sessionService.getAllActiveSessions();
    return c.json(sessions);
  });

  // Get session by ID
  router.get("/:id", (c) => {
    const { id } = c.req.param();
    const session = sessionService.getSessionById(id);

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
      session_name?: string;
      project_path?: string;
    }>();

    const session = sessionService.createOrUpdateSession(body);
    return c.json(session);
  });

  // Update session status
  router.patch("/:id/status", async (c) => {
    const { id } = c.req.param();
    const { status } = await c.req.json<{ status: SessionStatus }>();

    const updatedSession = sessionService.updateStatus(id, status);

    if (!updatedSession) {
      return c.json({ error: "Session not found" }, 404);
    }

    return c.json(updatedSession);
  });

  // Get session history
  router.get("/history/all", (c) => {
    const limit = Number(c.req.query("limit")) || 50;
    const sessions = sessionService.getSessionHistory(limit);
    return c.json(sessions);
  });

  return router;
}