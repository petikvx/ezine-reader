#!/usr/bin/env bash
# Launch the ezine reader: ./serve.sh [port]   (default 8000)
set -euo pipefail
cd "$(dirname "$0")"
PORT="${1:-8000}"
# Regenerate catalog/search index if missing
[ -f data/catalog.json ] || echo "data/ missing: run tools/build.py first" >&2; exit 1
URL="http://localhost:$PORT/"
echo "29A ezine reader -> $URL  (Ctrl+C to stop)"
(sleep 1; command -v xdg-open >/dev/null && xdg-open "$URL" >/dev/null 2>&1 || true) &
exec python3 -m http.server "$PORT" --bind 127.0.0.1
