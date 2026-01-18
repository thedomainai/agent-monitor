import { Hono } from "hono";
import { execSync } from "child_process";

export function focusRouter() {
  const router = new Hono();

  // Focus iTerm2 tab by session ID
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
