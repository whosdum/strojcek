#!/usr/bin/env bash
# Set every Cloud Secret Manager value referenced by apphosting.yaml.
#
# Reads from your local .env (via `set -a; source .env; set +a`) and pushes
# each non-empty variable to Cloud Secret Manager via `firebase apphosting:secrets:set`.
#
# Run AFTER:
#   1. Upgrade Firebase project to Blaze plan
#   2. firebase apphosting:backends:create
#
# Re-running is safe — it just creates new secret versions.

set -euo pipefail

if [[ ! -f .env ]]; then
  echo "✗ .env not found in $(pwd)"
  exit 1
fi

# shellcheck disable=SC1091
set -a; source .env; set +a

PROJECT="${1:-strojcek-staging}"

push() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$value" ]]; then
    echo "  - $name: skip (empty)"
    return
  fi
  echo "  - $name: setting…"
  printf '%s' "$value" | firebase apphosting:secrets:set "$name" \
    --project "$PROJECT" \
    --force \
    --data-file=- > /dev/null
  echo "    ✓"
}

echo "Setting App Hosting secrets in project: $PROJECT"
push FIREBASE_CLIENT_EMAIL
push FIREBASE_PRIVATE_KEY
push SMTP_USER
push SMTP_PASS
push SMSTOOLS_API_KEY
push TELEGRAM_BOT_TOKEN
push TELEGRAM_CHAT_ID
push CRON_SECRET

echo
echo "Done. Verify in Firebase Console → App Hosting → backend → Secrets,"
echo "or run: firebase apphosting:secrets:describe FIREBASE_CLIENT_EMAIL"
