import { useEffect, useState } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { SessionCard } from "./components/SessionCard";
import { Dashboard } from "./components/Dashboard";
import type { Session } from "./types";

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const { lastMessage } = useWebSocket("ws://localhost:3001/ws");

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

  async function handleFocus(itermSessionId: string) {
    try {
      await fetch(`/api/focus/${itermSessionId}`, { method: "POST" });
    } catch (error) {
      console.error("Failed to focus tab:", error);
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

      <style>{`
        .app {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
        }

        .header h1 {
          font-size: 20px;
          font-weight: 600;
        }

        .session-count {
          color: var(--text-secondary);
          font-size: 14px;
        }

        .main {
          flex: 1;
          padding: 24px;
        }

        .sessions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 16px;
          margin-top: 24px;
        }

        .empty-state {
          grid-column: 1 / -1;
          text-align: center;
          padding: 48px;
          color: var(--text-secondary);
        }

        .empty-state .hint {
          font-size: 14px;
          margin-top: 8px;
        }
      `}</style>
    </div>
  );
}

export default App;
