#!/bin/bash

# Agent Monitor Hook Script for Gemini CLI
# This script is called by Gemini CLI hooks to report events to the monitor

API_URL="${AGENT_MONITOR_API_URL:-http://localhost:3001}"
EVENT_TYPE="$1"

# Map Gemini CLI event names to internal event names
case "$EVENT_TYPE" in
  "BeforeTool")
    EVENT_TYPE="PreToolUse"
    ;;
  "AfterTool")
    EVENT_TYPE="PostToolUse"
    ;;
  "SessionEnd")
    EVENT_TYPE="Stop"
    ;;
esac

# Read the hook input from stdin
INPUT=$(cat)

# Extract session ID from Gemini CLI environment or generate one based on PWD
SESSION_ID="${GEMINI_SESSION_ID:-$(echo "gemini-$PWD" | md5sum | cut -d' ' -f1)}"

# Detect terminal type
TERMINAL_TYPE="unknown"
ITERM_SESSION_ID=""

# Check if running in Cursor/VSCode integrated terminal
if [ -n "$VSCODE_INJECTION" ] || [ -n "$TERM_PROGRAM" ] && [ "$TERM_PROGRAM" = "vscode" ]; then
  TERMINAL_TYPE="cursor"
# Check if running in iTerm2
elif [ "$TERM_PROGRAM" = "iTerm.app" ] || [ -n "$ITERM_SESSION_ID" ]; then
  TERMINAL_TYPE="iterm"
  # Get iTerm2 session ID if available
  ITERM_SESSION_ID="${ITERM_SESSION_ID:-}"
  if [ -z "$ITERM_SESSION_ID" ]; then
    ITERM_SESSION_ID=$(osascript -e '
      tell application "iTerm2"
        if exists current window then
          tell current window
            if exists current tab then
              tell current tab
                if exists current session then
                  return unique id of current session
                end if
              end tell
            end if
          end tell
        end if
        return ""
      end tell
    ' 2>/dev/null)
  fi
# Check if running in Apple Terminal
elif [ "$TERM_PROGRAM" = "Apple_Terminal" ]; then
  TERMINAL_TYPE="terminal"
fi

# Get session/tab name via AppleScript (iTerm only)
SESSION_NAME=""
if [ "$TERMINAL_TYPE" = "iterm" ] && [ -n "$ITERM_SESSION_ID" ]; then
  SESSION_NAME=$(osascript -e '
    tell application "iTerm2"
      repeat with aWindow in windows
        repeat with aTab in tabs of aWindow
          repeat with aSession in sessions of aTab
            if unique id of aSession is "'"$ITERM_SESSION_ID"'" then
              return name of aTab
            end if
          end repeat
        end repeat
      end repeat
      return ""
    end tell
  ' 2>/dev/null)
fi

# Get current working directory as project path
PROJECT_PATH="$PWD"

# Extract tool name if available
TOOL_NAME=""
if [ -n "$INPUT" ]; then
  TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // .toolName // empty' 2>/dev/null)
fi

# Build JSON payload
PAYLOAD=$(jq -n \
  --arg session_id "$SESSION_ID" \
  --arg event_type "$EVENT_TYPE" \
  --arg tool_name "$TOOL_NAME" \
  --arg iterm_session_id "$ITERM_SESSION_ID" \
  --arg terminal_type "$TERMINAL_TYPE" \
  --arg session_name "$SESSION_NAME" \
  --arg project_path "$PROJECT_PATH" \
  '{
    session_id: $session_id,
    event_type: $event_type,
    tool_name: (if $tool_name != "" then $tool_name else null end),
    iterm_session_id: (if $iterm_session_id != "" then $iterm_session_id else null end),
    terminal_type: $terminal_type,
    session_name: (if $session_name != "" then $session_name else null end),
    project_path: $project_path
  }')

# Log the payload for debugging
echo "[$(date)] [Gemini] Sending $EVENT_TYPE for session $SESSION_ID" >> /tmp/agent-monitor-hook.log

# Send event to API
curl -s -X POST "$API_URL/api/events" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  --max-time 2 \
  >> /tmp/agent-monitor-hook.log 2>&1 &

# Register session with terminal-id extension (for Cursor/VSCode)
if [ "$TERMINAL_TYPE" = "cursor" ] || [ "$TERMINAL_TYPE" = "vscode" ]; then
  TERMINAL_ID_PORT="${TERMINAL_ID_PORT:-3002}"
  # Use websocat if available, otherwise skip
  if command -v websocat &> /dev/null; then
    echo "{\"type\":\"register\",\"sessionId\":\"$SESSION_ID\",\"cwd\":\"$PROJECT_PATH\"}" | \
      websocat -t "ws://localhost:$TERMINAL_ID_PORT" &
  fi
fi

# Exit successfully to not block Gemini CLI
exit 0
