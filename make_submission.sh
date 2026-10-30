#!/usr/bin/env bash
# Builds the zip to upload to the course site:
#   MordehaiLevy.zip -> MordehaiLevy/{Database,Backend,Frontend,README.md,...}
# without .env, the Python env folder, node_modules, dist and caches.
# Run it after exporting the database (see Database/README in the main README).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
NAME="MordehaiLevy"
OUT="$ROOT/submission"

# the database export must match the current schema (pinned column)
grep -q '`pinned`' "$ROOT/Database/chatgpt_clone.sql" || { echo "ERROR: Database/chatgpt_clone.sql is outdated (no pinned column): re-export it" >&2; exit 1; }

rm -rf "$OUT"
rm -f "$ROOT/$NAME.zip"   # zip would otherwise update the old archive and keep deleted files
mkdir -p "$OUT/$NAME"

rsync -a "$ROOT/" "$OUT/$NAME/" \
  --exclude 'submission/' \
  --exclude '.git/' \
  --exclude '.claude/' \
  --exclude 'docs/audit/' \
  --exclude 'Backend/env/' \
  --exclude 'Backend/.env' \
  --exclude 'Frontend/.env' \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude '__pycache__/' \
  --exclude '.pytest_cache/' \
  --exclude '.DS_Store' \
  --exclude '*.zip' \
  --exclude 'make_submission.sh'

# safety checks
if find "$OUT" -name '.env' | grep -q .; then echo "ERROR: a .env file is in the zip" >&2; exit 1; fi
if find "$OUT" -type d \( -name node_modules -o -name env \) | grep -q .; then echo "ERROR: env or node_modules in the zip" >&2; exit 1; fi
for f in Database/schema.sql Backend/requirements.txt Backend/ChatGPT-Clone.postman_collection.json README.md; do
  [ -f "$OUT/$NAME/$f" ] || { echo "ERROR: missing $f" >&2; exit 1; }
done

(cd "$OUT" && zip -qr "$ROOT/$NAME.zip" "$NAME")
echo "Created $ROOT/$NAME.zip ($(du -h "$ROOT/$NAME.zip" | cut -f1))"
