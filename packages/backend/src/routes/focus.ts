import { Hono } from "hono";
import { execSync } from "child_process";
// @ts-ignore - ws has no type declarations in this project
import WebSocket from "ws";

const TERMINAL_ID_PORT = process.env.TERMINAL_ID_PORT || 3002;

// Helper function to generate iTerm2 focus AppleScript
function generateItermFocusScript(sessionId: string): string {
  return `
tell application "iTerm2"
    repeat with aWindow in windows
        repeat with aTab in tabs of aWindow
            repeat with aSession in sessions of aTab
                if unique id of aSession is "${sessionId}" then
                    select aTab
                    select aWindow
                    activate
                    return "focused"
                end if
            end repeat
        end repeat
    end repeat
    return "not_found"
end tell
`;
}

async function focusViaExtension(sessionId: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(`ws://localhost:${TERMINAL_ID_PORT}`);
      const timeout = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 2000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'focus', sessionId }));
      });

      ws.on('message', (data: Buffer) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data.toString());
          ws.close();
          resolve(response.success === true);
        } catch {
          ws.close();
          resolve(false);
        }
      });

      ws.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

export function focusRouter() {
  const router = new Hono();

  // Focus iTerm2 tab by session ID
  router.post("/iterm/:itermSessionId", (c) => {
    const { itermSessionId } = c.req.param();
    const appleScript = generateItermFocusScript(itermSessionId);

    try {
      const result = execSync(`osascript -e '${appleScript}'`, {
        encoding: "utf-8",
      }).trim();

      if (result === "focused") {
        return c.json({ success: true, message: "Tab focused" });
      } else {
        return c.json({ success: false, message: "Session not found" }, 404);
      }
    } catch (error) {
      return c.json(
        {
          success: false,
          message: "Failed to focus tab",
          error: String(error),
        },
        500
      );
    }
  });

  // Focus Cursor terminal by session ID (via extension) or project path (fallback)
  router.post("/cursor", async (c) => {
    const { projectPath, sessionId } = await c.req.json<{ projectPath: string; sessionId?: string }>();

    if (!projectPath) {
      return c.json({ success: false, message: "Project path is required" }, 400);
    }

    // Try terminal-id extension first
    if (sessionId) {
      const focused = await focusViaExtension(sessionId);
      if (focused) {
        return c.json({ success: true, message: "Focused via extension" });
      }
    }

    // Fallback: AppleScript to focus Cursor window with matching project path
    const appleScript = `
tell application "Cursor"
    activate
    set targetPath to "${projectPath}"
    repeat with w in windows
        try
            set docPath to path of document of w
            if docPath starts with targetPath or targetPath starts with docPath then
                set index of w to 1
                return "focused"
            end if
        end try
    end repeat
    -- If no matching window found, try to open the folder
    open targetPath
    return "opened"
end tell
`;

    try {
      const result = execSync(`osascript -e '${appleScript}'`, {
        encoding: "utf-8",
      }).trim();

      // After focusing Cursor, try to focus terminal
      const showTerminalScript = `
tell application "System Events"
    tell process "Cursor"
        keystroke "p" using {command down, shift down}
        delay 0.3
        keystroke "Terminal: Focus Terminal"
        delay 0.2
        key code 36
    end tell
end tell
`;
      try {
        execSync(`osascript -e '${showTerminalScript}'`, { encoding: "utf-8" });
      } catch {
        // Fallback: try simple Cmd+` for terminal panel
        const fallbackScript = `
tell application "System Events"
    tell process "Cursor"
        keystroke "\`" using command down
    end tell
end tell
`;
        try {
          execSync(`osascript -e '${fallbackScript}'`, { encoding: "utf-8" });
        } catch {
          // Ignore if keystroke fails
        }
      }

      return c.json({ success: true, message: result === "focused" ? "Window focused" : "Folder opened" });
    } catch (error) {
      return c.json(
        {
          success: false,
          message: "Failed to focus Cursor",
          error: String(error),
        },
        500
      );
    }
  });

  return router;
}
