import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { initDatabase } from "./db.js";
import { SessionRepository } from "./repositories/sessionRepository.js";
import { SessionService } from "./services/sessionService.js";
import { sessionsRouter } from "./routes/sessions.js";
import { eventsRouter } from "./routes/events.js";
import { focusRouter } from "./routes/focus.js";

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// Initialize database
const db = initDatabase();

// Middleware
app.use("/*", logger());
app.use("/*", cors());

// Store for WebSocket clients
const wsClients = new Set<WebSocket>();

// WebSocket endpoint for realtime updates
app.get(
  "/ws",
  upgradeWebSocket(() => ({
    onOpen(_event, ws) {
      wsClients.add(ws.raw as unknown as WebSocket);
      console.log("WebSocket client connected");
    },
    onClose(_event, ws) {
      wsClients.delete(ws.raw as unknown as WebSocket);
      console.log("WebSocket client disconnected");
    },
  }))
);

// Broadcast to all connected clients
export function broadcast(data: object) {
  const message = JSON.stringify(data);
  wsClients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

// Initialize services
const sessionRepo = new SessionRepository(db);
const sessionService = new SessionService(sessionRepo, broadcast);

// API Routes
app.route("/api/sessions", sessionsRouter(sessionService));
app.route("/api/events", eventsRouter(sessionService));
app.route("/api/focus", focusRouter());

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Serve static files from frontend build (production)
app.use("/*", serveStatic({ root: "../frontend/dist" }));

// Fallback to index.html for SPA routing
app.get("*", serveStatic({ path: "../frontend/dist/index.html" }));

const port = Number(process.env.PORT) || 3001;

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🚀 Agent Monitor API running on http://localhost:${info.port}`);
});

injectWebSocket(server);
