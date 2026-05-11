#!/usr/bin/env bash
# Create Firestore scheduled backups for a project.
#
# Sets up two backup schedules:
#   - Daily backups with 7-day retention
#   - Weekly backups (Sunday) with 14-week retention
#
# Requires gcloud CLI:
#   brew install --cask google-cloud-sdk
#   gcloud auth login
#   gcloud config set project strojcek-production   # or strojcek-staging
#
# Usage:
#   ./scripts/setup-firestore-backups.sh strojcek-staging
#   ./scripts/setup-firestore-backups.sh strojcek-production
#
# Re-running is safe — gcloud rejects duplicates with a clear error, the
# script keeps going and reports what already exists.

set -uo pipefail

PROJECT="${1:-}"
if [[ -z "$PROJECT" ]]; then
  echo "✗ Usage: $0 <gcp-project-id>"
  echo "  e.g.  $0 strojcek-production"
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "✗ gcloud CLI not found."
  echo "  Install: brew install --cask google-cloud-sdk"
  echo "  Then:    gcloud auth login"
  exit 1
fi

echo "Setting up Firestore backup schedules in project: $PROJECT"
echo

create_schedule() {
  local label="$1"
  shift
  echo "→ $label"
  if gcloud firestore backups schedules create \
       --database='(default)' \
       --project="$PROJECT" \
       "$@" 2>&1 | tee /tmp/firestore-backup-out.log; then
    echo "  ✓ created"
  else
    if grep -q -i "already exists\|ALREADY_EXISTS" /tmp/firestore-backup-out.log; then
      echo "  ⊙ already exists — skipping"
    else
      echo "  ✗ failed (see error above)"
      return 1
    fi
  fi
  echo
}

create_schedule "Daily backups, 7-day retention" \
  --recurrence=daily \
  --retention=7d

create_schedule "Weekly backups (Sunday), 14-week retention" \
  --recurrence=weekly \
  --retention=14w \
  --day-of-week=SUN

echo "Done. Existing schedules in $PROJECT:"
gcloud firestore backups schedules list \
  --database='(default)' \
  --project="$PROJECT" \
  --format='table(name.basename(),recurrence,retention)'
