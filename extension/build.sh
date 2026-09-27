#!/usr/bin/env sh
# Packages the extension into dist/domaindoctor-extension-<version>.zip, ready to upload.
set -e
cd "$(dirname "$0")"
VERSION=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json | head -1)
mkdir -p dist
OUT="dist/domaindoctor-extension-$VERSION.zip"
rm -f "$OUT"
zip -q -r "$OUT" manifest.json popup.html popup.css popup.js checks.js icons
echo "Built $OUT"
