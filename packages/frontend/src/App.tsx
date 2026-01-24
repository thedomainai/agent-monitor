import { useEffect, useState } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { SessionCard } from "./components/SessionCard";
import { Dashboard } from "./components/Dashboard";
import type { Session } from "@agent-monitor/shared";
import "./App.css";

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  const { lastMessage } = useWebSocket(wsUrl);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (lastMessage) {
      const data = JSON.parse(lastMessage);
      if (data.type === "session_updated" || data.type === "event_received") {
        fetchSessions();
      }
    }
  }, [lastMessage]);

  async function fetchSessions() {
    try {
      const res = await fetch("/api/sessions");
      const data = await res.json();
      setSessions(data);
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    }
  }

  async function handleFocus(session: Session) {
    try {
      if (session.terminal_type === "iterm" && session.iterm_session_id) {
        await fetch(`/api/focus/iterm/${session.iterm_session_id}`, { method: "POST" });
      } else if (session.project_path) {
        // For cursor, vscode, unknown - try to focus via extension, fallback to AppleScript
        await fetch("/api/focus/cursor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectPath: session.project_path,
            sessionId: session.id
          }),
        });
      }
    } catch (error) {
      console.error("Failed to focus session:", error);
    }
  }

  async function handleStop(session: Session) {
    if (!confirm("Are you sure you want to remove this session?")) return;

    try {
      await fetch(`/api/sessions/${session.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "stopped" }),
      });
      // Optimistic update
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
    } catch (error) {
      console.error("Failed to stop session:", error);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Agent Monitor</h1>
        <span className="session-count">{sessions.length} active sessions</span>
      </header>

      <main className="main">
        <Dashboard sessions={sessions} />

        <section className="sessions-grid">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onFocus={handleFocus}
              onStop={handleStop}
            />
          ))}
          {sessions.length === 0 && (
            <div className="empty-state">
              <p>No active sessions</p>
              <p className="hint">
                Start a Claude Code session with hooks configured to see it
                here.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
