#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/images"
DEST="$ROOT/public/images"

if [ ! -d "$SRC" ]; then
  echo "ℹ️  No images directory at $SRC; skipping sync."
  exit 0
fi

echo "🔍 Scanning image filenames for invalid characters..."

has_offenders=0
while IFS= read -r -d '' f; do
  filename="${f##*/}"
  # Characters to forbid: # ? / \ space
  if [[ "$filename" =~ [#\?\\\ ] ]]; then
    if [ "$has_offenders" -eq 0 ]; then
      echo "❌ Build blocked: Found filenames containing forbidden characters."
      echo "Forbidden characters:  #  ?  /  \\  (space)"
      has_offenders=1
    fi
    rel="${f#"$SRC"/}"
    echo "   - $rel"
  fi
done < <(find "$SRC" -type f -print0)

if [ "$has_offenders" -ne 0 ]; then
  echo
  echo "Tip: rename offending files (use hyphens or underscores instead)."
  echo "Example:  'My Image (v2)#final?.jpg' → 'My-Image-v2-final.jpg'"
  exit 1
fi

echo "✅ Filenames OK. Mirroring $SRC → $DEST ..."
rm -rf "$DEST"
mkdir -p "$DEST"
cp -a "$SRC/." "$DEST/"

echo "✅ Synced originals to public/images (no illegal filenames found)"
