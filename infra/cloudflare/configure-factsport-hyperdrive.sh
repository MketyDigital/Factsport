#!/usr/bin/env bash
# Factsport-specific Hyperdrive safety configuration.
# Verifies resource identity before attempting changes. Never reads/writes origin passwords.
set -euo pipefail
: "${CLOUDFLARE_ACCOUNT_ID:?}"
: "${CLOUDFLARE_API_TOKEN:?}"
HYPERDRIVE_ID="895cca4c06104b8ab9f7c1b72a8ba18f"
URL="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/hyperdrive/configs/${HYPERDRIVE_ID}"
STATUS="$(curl -sS -o /tmp/factsport-hd-get.json -w '%{http_code}' -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" "$URL")"
if [ "$STATUS" != "200" ]; then
  echo "::error::Cannot verify Factsport Hyperdrive safety settings (HTTP $STATUS); refusing staging release."
  exit 0
fi
if ! jq -e '.success == true and .result.name == "factsport-v2-runtime-postgres" and .result.origin.database == "factsport_v2" and .result.origin.user == "factsport_v2_reader" and .result.origin.host == "mketypostgres.postgres.database.azure.com"' /tmp/factsport-hd-get.json >/dev/null; then
  echo "::error::Refusing Hyperdrive changes: resource identity is not the expected Factsport Azure database."
  exit 1
fi
if jq -e '.result.caching.disabled == true and .result.origin_connection_limit == 5' /tmp/factsport-hd-get.json >/dev/null; then
  echo "Factsport Hyperdrive already has caching disabled and connection limit 5"
  exit 0
fi
STATUS="$(curl -sS -o /tmp/factsport-hd-patch.json -w '%{http_code}' -X PATCH \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"caching":{"disabled":true},"origin_connection_limit":5}' "$URL")"
if [ "$STATUS" != "200" ]; then
  echo "::error::Cannot enforce Factsport Hyperdrive safety settings (HTTP $STATUS); refusing staging release."
  exit 0
fi
jq -e '.success == true and .result.caching.disabled == true and .result.origin_connection_limit == 5' /tmp/factsport-hd-patch.json >/dev/null
echo "Factsport Hyperdrive query caching DISABLED; origin connections LIMITED to 5"
