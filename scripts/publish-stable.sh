#!/bin/bash
#
# Publish a stable @gerryt/wolf release to npm.
#
# Strategy: build to ./dist, copy dist + package.stable.json + README + LICENSE
# into a fresh ./dist-package/ staging directory, and run `npm publish` from
# there. The root package.json (the dev workspace manifest) is never mutated.
#
# Hard gates enforced before any publish:
#   (b) git tag for the version exists locally and matches package.stable.json
#   (d) current branch is main, working tree clean (no uncommitted edits)
#
# Gates (a) full smoke + acceptance pass and (c) CHANGELOG.md updated are
# verified by the human releaser, not the script — see CLAUDE.md § Releasing.
#
# Usage:
#   ./scripts/publish-stable.sh
#
# The script stops *before* `npm publish` and prints the exact command to run,
# so the human types it (which triggers npm 2FA prompt) deliberately.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# ---------------------------------------------------------------------------
# Gate (d): branch + clean tree
# ---------------------------------------------------------------------------
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "main" ]]; then
  echo "publish-stable: refusing — current branch is '$BRANCH', publish only from 'main'." >&2
  exit 1
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "publish-stable: refusing — working tree has uncommitted changes." >&2
  git status --short >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Read the version we're about to publish
# ---------------------------------------------------------------------------
VERSION="$(node -e "console.log(JSON.parse(require('fs').readFileSync('package.stable.json','utf-8')).version)")"
TAG="v${VERSION}"
echo "publish-stable: target version = ${VERSION}"

# ---------------------------------------------------------------------------
# Gate (b): git tag for this version exists locally
# ---------------------------------------------------------------------------
if ! git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "publish-stable: refusing — git tag '$TAG' does not exist locally." >&2
  echo "Create it with:  git tag -a '$TAG' -m 'release $VERSION'" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Build stable, then stage the publish directory
# ---------------------------------------------------------------------------
echo "publish-stable: building stable bundle..."
rm -rf dist dist-package
npm run build

echo "publish-stable: staging dist-package/"
mkdir -p dist-package
cp package.stable.json dist-package/package.json
cp -r dist dist-package/dist
cp README.md LICENSE dist-package/

# ---------------------------------------------------------------------------
# Final preview — what's about to be published
# ---------------------------------------------------------------------------
echo
echo "publish-stable: dist-package/ ready. Contents:"
(cd dist-package && npm pack --dry-run 2>&1 | tail -40)

echo
echo "==========================================================="
echo "Publish staged at: $ROOT_DIR/dist-package"
echo "==========================================================="
echo "To publish, run:"
echo "    cd dist-package && npm publish --access public"
echo
echo "Then verify in a fresh shell:"
echo "    npm i -g @gerryt/wolf@$VERSION"
echo "    wolf --version"
echo "    wolf init --here && wolf doctor"
echo
echo "Then push the tag:"
echo "    git push origin $TAG"
