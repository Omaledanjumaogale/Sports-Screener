#!/usr/bin/env bash
# ── Cloudflare Pages preview cleanup ──────────────────────────────────────────
# Lists preview deployments (non-production branches) and deletes all but the
# newest N per project, so regression-test branches don't accumulate.
#
# Usage: CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... bash scripts/cleanup-previews.sh [keep]
#   keep  how many recent preview deployments to retain (default 5)

set -euo pipefail
KEEP="${1:-5}"
: "${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN}"
: "${CLOUDFLARE_ACCOUNT_ID:?Set CLOUDFLARE_ACCOUNT_ID}"
PROJECT="pulseodds-screener"
API="https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PROJECT/deployments"

# Collect preview (non-production) deployment IDs, newest first.
PREVIEWS=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "$API?per_page=100" \
  | node -e "
      let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{
        const j=JSON.parse(d);
        const rows=(j.result||[]).filter(x=>!x.production_branch||x.deployment_trigger?.metadata?.branch!==x.production_branch);
        console.log(rows.map(x=>x.id).join('\n'));
      });")

TOTAL=$(printf '%s' "$PREVIEWS" | grep -c . || true)
echo "[previews] found $TOTAL preview deployment(s)"

i=0
printf '%s\n' "$PREVIEWS" | while read -r id; do
  [ -z "$id" ] && continue
  i=$((i + 1))
  if [ "$i" -le "$KEEP" ]; then
    echo "[previews] keep  $id"
  else
    code=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      "$API/$id?force=true")
    echo "[previews] delete $id → HTTP $code"
  fi
done
echo "[previews] cleanup done"
