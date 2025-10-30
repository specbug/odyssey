#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="${ROOT_DIR}/packages/ui-foundation/tokens.json"
TARGET="${ROOT_DIR}/apps/mac/OdysseyMacApp/Sources/OdysseyMacApp/Resources/design-tokens.json"

if [[ ! -f "${SOURCE}" ]]; then
  echo "Source tokens not found: ${SOURCE}" >&2
  exit 1
fi

cp "${SOURCE}" "${TARGET}"
echo "✅ Synced design tokens to ${TARGET}"
