#!/bin/bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:8080}"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required"
  exit 1
fi

create_source() {
  local name="$1"
  local display_name="$2"
  local description="$3"
  local api_key="${4:-}"

  local response
  response="$(curl -sS -X POST "${API_BASE_URL}/sources" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"${name}\",
      \"display_name\": \"${display_name}\",
      \"api_base_url\": \"\",
      \"api_key\": \"${api_key}\",
      \"description\": \"${description}\"
    }")"

  if echo "${response}" | grep -q '"error"'; then
    if echo "${response}" | grep -q 'duplicate key'; then
      echo "source ${name} already exists, reusing existing record" >&2
      find_source_id "${name}"
      return
    fi

    echo "failed to create source ${name}: ${response}"
    exit 1
  fi

  echo "${response}" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p'
}

find_source_id() {
  local name="$1"
  local response
  response="$(curl -sS "${API_BASE_URL}/sources")"

  if echo "${response}" | grep -q '"error"'; then
    echo "failed to fetch sources while looking up ${name}: ${response}" >&2
    exit 1
  fi

  echo "${response}" | tr '{' '\n' | grep "\"name\":\"${name}\"" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p' | head -n 1
}

sync_source() {
  local source_id="$1"
  local source_name="$2"

  if [ -z "${source_id}" ]; then
    echo "missing source id for ${source_name}"
    exit 1
  fi

  echo "syncing ${source_name}..."
  curl -sS -X POST "${API_BASE_URL}/sources/${source_id}/sync"
  echo
}

ensure_backend() {
  local health
  health="$(curl -sS "${API_BASE_URL}/health" || true)"
  if ! echo "${health}" | grep -q "ok"; then
    echo "backend is not reachable at ${API_BASE_URL}"
    exit 1
  fi
}

bootstrap_public_sources() {
  local world_bank_id
  local oecd_id
  local eurostat_id

  world_bank_id="$(create_source "world_bank" "World Bank" "Public macro datasets from the World Bank")"
  oecd_id="$(create_source "oecd" "OECD" "Public macro datasets from OECD")"
  eurostat_id="$(create_source "eurostat" "Eurostat" "Public macro datasets from Eurostat")"

  sync_source "${world_bank_id}" "world_bank"
  sync_source "${oecd_id}" "oecd"
  sync_source "${eurostat_id}" "eurostat"
}

bootstrap_fred_if_configured() {
  if [ -z "${FRED_API_KEY:-}" ]; then
    echo "FRED_API_KEY not set, skipping fred"
    return
  fi

  local fred_id
  fred_id="$(create_source "fred" "FRED" "Federal Reserve Economic Data" "${FRED_API_KEY}")"
  sync_source "${fred_id}" "fred"
}

main() {
  ensure_backend
  bootstrap_public_sources
  bootstrap_fred_if_configured
  echo "bootstrap complete"
}

main "$@"
