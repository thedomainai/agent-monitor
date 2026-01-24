import { Hono } from "hono";
import { execSync } from "child_process";
import type { SessionService } from "../services/sessionService.js";
import type { TerminalType } from "@agent-monitor/shared";

export function eventsRouter(sessionService: SessionService) {
  const router = new Hono();

  // Record event from hook
  router.post("/", async (c) => {
    const body = await c.req.json<{
      session_id: string;
      event_type: string;
      tool_name?: string;
      payload?: object;
      iterm_session_id?: string;
      terminal_type?: string;
      session_name?: string;
      project_path?: string;
    }>();

    const { session, shouldNotify } = sessionService.handleEvent({
      ...body,
      terminal_type: body.terminal_type as TerminalType | undefined,
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

    return c.json({ success: true, session });
  });

  // Get events for a session
  router.get("/:sessionId", (c) => {
    const { sessionId } = c.req.param();
    const limit = Number(c.req.query("limit")) || 100;

    const events = sessionService.getSessionEvents(sessionId, limit);

    return c.json(events);
  });

  return router;
}