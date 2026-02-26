#!/usr/bin/env bash
# Aviary Team — Shell helpers for multi-Claude workflows
# Source this in .zshrc: source ~/workspace/aviary/.claude/scripts/team.sh

AVIARY_ROOT="${AVIARY_ROOT:-$HOME/workspace/aviary}"

# Short wordlist for auto-naming workers
_WORKER_NAMES=(alpha bravo charlie delta echo foxtrot golf hotel)
_WORKER_INDEX=0

# Launch a worker Claude that waits for tasks.
# Usage: worker [name]
# Examples:
#   worker           → auto-named "alpha", "bravo", etc.
#   worker sparrow   → named "sparrow"
worker() {
  local name="${1:-${_WORKER_NAMES[$_WORKER_INDEX]}}"
  _WORKER_INDEX=$(( (_WORKER_INDEX + 1) % ${#_WORKER_NAMES[@]} ))

  cd "$AVIARY_ROOT" || return 1

  echo "Starting worker '$name'..."

  claude \
    --append-system-prompt "$(cat "$AVIARY_ROOT/.claude/prompts/worker.md")" \
    --permission-mode acceptEdits \
    "You are worker '$name'. Say hello and that you're ready for a task."
}
