#!/usr/bin/env bash
# Idempotently ensure a PRIVATE staging R2 bucket exists.
# Requires CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN via masked GH Actions secrets.
set -euo pipefail
: "${CLOUDFLARE_ACCOUNT_ID:?missing account id}"
: "${CLOUDFLARE_API_TOKEN:?missing API token}"
BUCKET="factsport-v2-media-staging"
API="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets"
AUTH="Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"
# Distinguish 404 (bucket absent) from authentication, scope or network failures.
STATUS="$(curl -sS -o /tmp/factsport-r2-get.json -w '%{http_code}' -H "$AUTH" "$API/$BUCKET")"
case "$STATUS" in
  200)
    jq -e '.success == true and .result.name == "factsport-v2-media-staging"' /tmp/factsport-r2-get.json >/dev/null
    echo "R2 staging bucket exists"
    ;;
  404)
    echo "Creating private R2 staging bucket"
    STATUS="$(curl -sS -o /tmp/factsport-r2-create.json -w '%{http_code}' \
      -X POST -H "$AUTH" -H "Content-Type: application/json" \
      --data '{"name":"factsport-v2-media-staging","storageClass":"Standard"}' "$API")"
    if [ "$STATUS" != "200" ] && [ "$STATUS" != "201" ]; then
      echo "::error::R2 bucket creation failed (HTTP $STATUS). Check token R2 Storage Write permission."
      exit 1
    fi
    jq -e '.success == true and .result.name == "factsport-v2-media-staging"' /tmp/factsport-r2-create.json >/dev/null
    echo "R2 staging bucket created (private by default)"
    ;;
  *)
    echo "::error::Could not inspect R2 bucket (HTTP $STATUS). Check Cloudflare account, token and R2 permissions."
    exit 1
    ;;
esac

# Verify both public access mechanisms remain disabled. R2 is private by default,
# but staging release must fail closed if an account-level setting exposes it.
MANAGED_URL="${API}/${BUCKET}/domains/managed"
STATUS="$(curl -sS -o /tmp/factsport-r2-managed-domain.json -w '%{http_code}' -H "$AUTH" "$MANAGED_URL")"
[ "$STATUS" = "200" ] && jq -e '.success == true and .result.enabled == false' /tmp/factsport-r2-managed-domain.json >/dev/null || {
  echo "::error::R2 managed r2.dev public access is enabled or could not be verified; disable it before staging."
  exit 1
}
CUSTOM_URL="${API}/${BUCKET}/domains/custom"
STATUS="$(curl -sS -o /tmp/factsport-r2-custom-domains.json -w '%{http_code}' -H "$AUTH" "$CUSTOM_URL")"
[ "$STATUS" = "200" ] && jq -e '.success == true and ((.result.domains // []) | all(.enabled == false))' /tmp/factsport-r2-custom-domains.json >/dev/null || {
  echo "::error::R2 custom-domain public access is enabled or could not be verified; remove/disable it before staging."
  exit 1
}
echo "R2 staging bucket verified private: managed r2.dev disabled and no enabled custom domains"
