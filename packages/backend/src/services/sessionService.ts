import { SessionRepository } from "../repositories/sessionRepository.js";
import type { Session, SessionStatus, TerminalType } from "@agent-monitor/shared";

export class SessionService {
  constructor(private repo: SessionRepository, private broadcast: (data: object) => void) {}

  getAllActiveSessions(): Session[] {
    return this.repo.findAll();
  }

  getSessionById(id: string): Session | undefined {
    return this.repo.findById(id);
  }
  
  getSessionHistory(limit?: number): Session[] {
    return this.repo.findHistory(limit);
  }

  createOrUpdateSession(params: {
    session_id: string;
    iterm_session_id?: string;
    session_name?: string;
    project_path?: string;
  }): Session {
    const existing = this.repo.findById(params.session_id);

    if (existing) {
      this.repo.update(params.session_id, params);
    } else {
      this.repo.create({
          id: params.session_id,
          iterm_session_id: params.iterm_session_id,
          session_name: params.session_name,
          project_path: params.project_path,
          status: 'ai_active'
      });
      // Start initial time tracking
      this.repo.startTimeTracking(params.session_id, 'ai_active');
    }
    
    const session = this.repo.findById(params.session_id)!;
    this.broadcast({ type: "session_updated", session });
    return session;
  }

  updateStatus(sessionId: string, status: SessionStatus): Session | undefined {
      const session = this.repo.findById(sessionId);
      if (!session) return undefined;

      // End current time tracking
      this.repo.endTimeTracking(sessionId);

      // Start new time tracking if not stopped
      if (status !== "stopped") {
        this.repo.startTimeTracking(sessionId, status);
      }

      this.repo.updateStatus(sessionId, status);
      
      const updatedSession = this.repo.findById(sessionId)!;
      this.broadcast({ type: "session_updated", session: updatedSession });
      
      return updatedSession;
  }

  handleEvent(params: {
      session_id: string;
      event_type: string;
      tool_name?: string;
      payload?: object;
      iterm_session_id?: string;
      terminal_type?: TerminalType;
      session_name?: string;
      project_path?: string;
  }): { session: Session; shouldNotify: boolean } {
      // Ensure session exists
      let session = this.repo.findById(params.session_id);

      if (!session) {
          this.repo.create({
            id: params.session_id,
            iterm_session_id: params.iterm_session_id,
            terminal_type: params.terminal_type || 'unknown',
            session_name: params.session_name,
            project_path: params.project_path,
            status: 'ai_active'
          });
          // Start initial time tracking
          this.repo.startTimeTracking(params.session_id, 'ai_active');
          session = this.repo.findById(params.session_id)!;
      } else if (params.session_name && !session.session_name) {
          this.repo.update(params.session_id, { session_name: params.session_name });
      }

      // Insert event
      this.repo.createEvent({
          session_id: params.session_id,
          event_type: params.event_type,
          tool_name: params.tool_name || null,
          payload: params.payload ? JSON.stringify(params.payload) : null
      });

      // Determine new status
      let newStatus = session.status;
      let shouldNotify = false;

      switch (params.event_type) {
        case "PreToolUse":
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

      if (newStatus !== session.status) {
          this.updateStatus(params.session_id, newStatus);
      } else {
          // Just update timestamp
          this.repo.update(params.session_id, {});
      }

      const updatedSession = this.repo.findById(params.session_id)!;

      this.broadcast({
        type: "event_received",
        event: params,
        session: updatedSession,
      });

      return { session: updatedSession, shouldNotify };
  }
  
  getSessionEvents(sessionId: string, limit?: number) {
      return this.repo.findEvents(sessionId, limit);
  }
}
