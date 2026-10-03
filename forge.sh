#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if ! command -v node >/dev/null 2>&1; then
  echo "[FORGE 3.2] Node.js 20 or newer is required: https://nodejs.org/" >&2
  exit 1
fi

cd "$ROOT"

if [ ! -d node_modules ]; then
  echo "[FORGE 3.2] Installing Node dependencies..."
  npm install --no-fund --no-audit
fi

npm run build

exec node "$ROOT/dist/main.js" "$@"
