#!/bin/bash

# Agent Monitor Hook Script
# This script is called by Claude Code hooks to report events to the monitor

API_URL="${AGENT_MONITOR_API_URL:-http://localhost:3001}"
EVENT_TYPE="$1"

# Read the hook input from stdin
INPUT=$(cat)

# Extract session ID from Claude Code environment or generate one
SESSION_ID="${CLAUDE_SESSION_ID:-$(echo "$PWD" | md5sum | cut -d' ' -f1)}"

# Get iTerm2 session ID if available
ITERM_SESSION_ID="${ITERM_SESSION_ID:-}"

# Get current working directory as project path
PROJECT_PATH="$PWD"

# Extract tool name if available (for PreToolUse/PostToolUse events)
TOOL_NAME=""
if [ -n "$INPUT" ]; then
  TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
fi

# Build JSON payload
PAYLOAD=$(jq -n \
  --arg session_id "$SESSION_ID" \
  --arg event_type "$EVENT_TYPE" \
  --arg tool_name "$TOOL_NAME" \
  --arg iterm_session_id "$ITERM_SESSION_ID" \
  --arg project_path "$PROJECT_PATH" \
  '{
    session_id: $session_id,
    event_type: $event_type,
    tool_name: (if $tool_name != "" then $tool_name else null end),
    iterm_session_id: (if $iterm_session_id != "" then $iterm_session_id else null end),
    project_path: $project_path
  }')

# Send event to API (async, don't block Claude Code)
curl -s -X POST "$API_URL/api/events" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  --max-time 2 \
  > /dev/null 2>&1 &

# Exit successfully to not block Claude Code
exit 0
