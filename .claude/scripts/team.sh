#!/usr/bin/env bash
# Aviary Team — Shell helpers for multi-Claude workflows
# Source this in .zshrc: source ~/workspace/aviary/.claude/scripts/team.sh

AVIARY_ROOT="${AVIARY_ROOT:-$HOME/workspace/aviary}"

# Promote the latest ready Vercel preview deployment to production.
# Usage: deploy
deploy() {
  cd "$AVIARY_ROOT" || return 1

  echo "Finding latest preview deployment..."
  local url
  url=$(vercel ls 2>/dev/null | awk '$5 == "Ready" && $6 == "Preview" { print $3; exit }')

  if [[ -z "$url" ]]; then
    echo "No ready preview deployment found."
    echo "Check 'vercel ls' — the latest build may still be in progress or errored."
    return 1
  fi

  echo ""
  echo "  Preview: $url"
  echo "  Target:  https://aviary.gregbigelow.com"
  echo ""
  echo -n "Promote to production? [y/N] "
  read -r confirm
  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    vercel promote "$url"
  else
    echo "Aborted."
  fi
}

# Launch a worker Claude that waits for tasks.
# Usage: worker
worker() {
  cd "$AVIARY_ROOT" || return 1

  echo "Starting worker..."

  claude \
    --append-system-prompt "$(cat "$AVIARY_ROOT/.claude/prompts/worker.md")" \
    --permission-mode acceptEdits \
    "Welcome to the team! We're glad you're here. Ready for a task whenever you are."
}
