#!/usr/bin/env bash
# Run the invite E2E tests.
# Starts the dev server if one isn't already running, runs the spec, then
# shuts down the server if we started it.

set -e

PORT=3000
SPEC="cypress/e2e/invite.cy.ts"
DEV_PID=""

# Check if a dev server is already listening on the port
if lsof -ti:$PORT &>/dev/null; then
  echo "→ Dev server already running on :$PORT"
else
  echo "→ Starting dev server..."
  npm run dev &>/tmp/aviary-dev.log &
  DEV_PID=$!

  echo -n "→ Waiting for server"
  for i in {1..30}; do
    code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT 2>/dev/null || true)
    if [ "$code" = "200" ] || [ "$code" = "307" ]; then
      echo " ready."
      break
    fi
    echo -n "."
    sleep 1
  done
fi

# Run Cypress — exit code is preserved for the caller
npx cypress run --spec "$SPEC"
EXIT=$?

# Shut down the server if we started it
if [ -n "$DEV_PID" ]; then
  echo "→ Stopping dev server (PID $DEV_PID)..."
  kill "$DEV_PID" 2>/dev/null || true
fi

exit $EXIT
