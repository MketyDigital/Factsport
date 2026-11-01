#!/usr/bin/env bash
# Factsport 2.0 - Azure staging PostgreSQL bootstrap
# Run manually in Azure Portal > Cloud Shell (Bash).
# SAFETY: defaults to DRY RUN. Explicit APPLY=1 required before billable resources.
# The script NEVER changes main Mkety tenant roles, production databases, or live endpoints.
set -euo pipefail
: "${SUBSCRIPTION_ID:?Set SUBSCRIPTION_ID to the intended Azure subscription GUID}"
: "${AZ_REGION:?Set AZ_REGION to a region that supports B1ms e.g. westeurope}"
: "${PG_SERVER:?Set PG_SERVER to a globally unique lowercase PostgreSQL server name}"
RG="${RG:-rg-factsport-v2-staging}"
DB_NAME="factsport_v2"
PG_ADMIN="${PG_ADMIN:-factsportbootstrap}"
APPLY="${APPLY:-0}"
if [[ ! "$PG_SERVER" =~ ^[a-z][a-z0-9-]{2,62}$ ]]; then
  echo "PG_SERVER must be lowercase, globally unique, start with a letter" >&2; exit 2
fi
if [[ "$RG" != *factsport* || "$RG" != *staging* ]]; then
  echo "Refusing non-staging resource group: $RG" >&2; exit 2
fi

echo "Inspecting current Azure context"
az account show --query '{subscription:id,tenant:tenantId,name:name}' -o table
az account set --subscription "$SUBSCRIPTION_ID"
az account show --query '{subscription:id,tenant:tenantId,name:name}' -o table
echo "Target: $RG / $AZ_REGION / $PG_SERVER; Burstable Standard_B1ms, storage 32GiB, no HA, 7d backups"
echo "This is a BILLABLE Azure Database for PostgreSQL server when APPLY=1."
if [[ "$APPLY" != "1" ]]; then
  echo "DRY RUN ONLY. Confirm subscription and region quote, then run APPLY=1."
  exit 0
fi

read -r -p "Type PROVISION-FACTSPORT-STAGING to create billable resources: " confirmation
[[ "$confirmation" == "PROVISION-FACTSPORT-STAGING" ]] || { echo "Cancelled"; exit 1; }
# Avoid printing the password or storing it in shell history/public repos.
read -r -s -p "Enter a NEW strong PostgreSQL admin password (not shared with other apps): " PG_PASSWORD
printf '\n'
[[ ${#PG_PASSWORD} -ge 20 ]] || { echo "Password must be at least 20 characters" >&2; exit 2; }

az group create --name "$RG" --location "$AZ_REGION" --tags app=Factsport environment=staging project=factsport-v2 -o table
# Public networking mode WITHOUT ANY allow-all firewall rule. Add a narrowly
# scoped Cloudflare Hyperdrive source after egress IP is positively verified.
# No database data is imported from Supabase.
az postgres flexible-server create \
  --resource-group "$RG" --name "$PG_SERVER" --location "$AZ_REGION" \
  --sku-name Standard_B1ms --tier Burstable \
  --storage-size 32 --storage-type Premium_LRS \
  --version 16 --backup-retention 7 \
  --geo-redundant-backup Disabled --zonal-resiliency Disabled \
  --public-access None \
  --admin-user "$PG_ADMIN" --admin-password "$PG_PASSWORD" \
  --tags app=Factsport environment=staging project=factsport-v2 \
  --yes --output table
unset PG_PASSWORD
az postgres flexible-server db create --resource-group "$RG" --server-name "$PG_SERVER" --database-name "$DB_NAME" --output table
echo "Created empty factsport_v2 DB; NO application tables/roles/data have been migrated."
echo "Next: scoped firewall/Hyperdrive networking, then 'CREATE DATABASE factsport_v2' via psql on a trusted client."
echo "Never allow 0.0.0.0-255.255.255.255, never store connection strings in code."
az postgres flexible-server show -g "$RG" -n "$PG_SERVER" --query '{name:name,sku:sku.name,storage:storage.storageSizeGb,version:version,state:state,ha:highAvailability.mode}' -o jsonc
