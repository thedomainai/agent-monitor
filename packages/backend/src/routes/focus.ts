import { Hono } from "hono";
import { execSync } from "child_process";
import type { TerminalType } from "@agent-monitor/shared";

export function focusRouter() {
  const router = new Hono();

  // Focus iTerm2 tab by session ID
  router.post("/iterm/:itermSessionId", (c) => {
    const { itermSessionId } = c.req.param();

    const appleScript = `
tell application "iTerm2"
    repeat with aWindow in windows
        repeat with aTab in tabs of aWindow
            repeat with aSession in sessions of aTab
                if unique id of aSession is "${itermSessionId}" then
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

  // Focus Cursor window by project path
  router.post("/cursor", async (c) => {
    const { projectPath } = await c.req.json<{ projectPath: string }>();

    if (!projectPath) {
      return c.json({ success: false, message: "Project path is required" }, 400);
    }

    // AppleScript to focus Cursor window with matching project path
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
      // First try Cmd+` (toggle terminal panel), then try command palette to focus terminal
      const showTerminalScript = `
tell application "System Events"
    tell process "Cursor"
        -- First, try Cmd+Shift+P to open command palette
        keystroke "p" using {command down, shift down}
        delay 0.3
        -- Type "Terminal: Focus Terminal" command
        keystroke "Terminal: Focus Terminal"
        delay 0.2
        -- Press Enter to execute
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

  // Legacy route for backward compatibility
  router.post("/:itermSessionId", (c) => {
    const { itermSessionId } = c.req.param();

    const appleScript = `
tell application "iTerm2"
    repeat with aWindow in windows
        repeat with aTab in tabs of aWindow
            repeat with aSession in sessions of aTab
                if unique id of aSession is "${itermSessionId}" then
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

  return router;
}
