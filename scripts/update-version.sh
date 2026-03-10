#!/usr/bin/env bash
set -euo pipefail

VERSION="$1"

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>" >&2
  exit 1
fi

echo "Updating version to $VERSION"

# Update Cargo.toml package version
sed -i "s/^version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml

# Update only the browse-it package version in Cargo.lock
sed -i "/^name = \"browse-it\"$/{n;s/^version = \".*\"/version = \"$VERSION\"/;}" src-tauri/Cargo.lock

# Update tauri.conf.json version
node -e "
  const fs = require('fs');
  const path = 'src-tauri/tauri.conf.json';
  const conf = JSON.parse(fs.readFileSync(path, 'utf8'));
  conf.version = '$VERSION';
  fs.writeFileSync(path, JSON.stringify(conf, null, 2) + '\n');
"

echo "Updated Cargo.toml, Cargo.lock, and tauri.conf.json to $VERSION"
