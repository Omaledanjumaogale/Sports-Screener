#!/usr/bin/env bash
# ── Convex backup export ───────────────────────────────────────────────────────
# Exports the production deployment to a timestamped zip. Run daily via cron/
# GitHub Actions; keep at least N local copies (rotation below).
#
# Usage: bash scripts/backup-convex.sh [keep]
#   keep  how many recent backups to retain (default 14)
#
# Requires: npx convex (authed CLI), zip. Convex Cloud retains snapshots 30 days
# on free/Pro; local exports extend that for the accumulate-forever tables
# (predictorVerdicts, auditEvents, aiPredictorStats).

set -euo pipefail
KEEP="${1:-14}"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
OUT_DIR="backups"
mkdir -p "$OUT_DIR"

echo "[backup] exporting Convex deployment..."
npx convex export --path "$OUT_DIR/convex-snapshot_$STAMP.zip"
echo "[backup] wrote $OUT_DIR/convex-snapshot_$STAMP.zip"

# Rotation: keep only the newest KEEP archives.
ls -1t "$OUT_DIR"/convex-snapshot_*.zip 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do
  rm -f "$old"
  echo "[backup] pruned $old"
done
echo "[backup] done ($(ls -1 "$OUT_DIR"/convex-snapshot_*.zip | wc -l) archives retained)"
