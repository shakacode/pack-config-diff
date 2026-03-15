#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

DRY_RUN=false
SKIP_TESTS=false
NPM_TAG=""

usage() {
  cat <<'EOF'
Usage: ./scripts/release.sh [options]

Options:
  --dry-run         Run publish in dry-run mode
  --skip-tests      Skip test/build checks (not recommended)
  --npm-tag <tag>   Publish to a specific npm dist-tag (e.g. next)
  -h, --help        Show this help message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --npm-tag)
      if [[ $# -lt 2 ]]; then
        echo "Error: --npm-tag requires a value" >&2
        exit 1
      fi
      NPM_TAG="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Error: unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: git working tree must be clean before release." >&2
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "Error: release must be run from main (current: $CURRENT_BRANCH)." >&2
  exit 1
fi

VERSION="$(node -p "require('./package.json').version")"
CHANGELOG_HEADING="## [v$VERSION]"

if ! grep -Fq "$CHANGELOG_HEADING" CHANGELOG.md; then
  echo "Error: CHANGELOG.md is missing heading: $CHANGELOG_HEADING" >&2
  exit 1
fi

if git rev-parse -q --verify "refs/tags/v$VERSION" >/dev/null; then
  echo "Error: git tag v$VERSION already exists locally." >&2
  exit 1
fi

if git ls-remote --exit-code --tags origin "refs/tags/v$VERSION" >/dev/null 2>&1; then
  echo "Error: git tag v$VERSION already exists on origin." >&2
  exit 1
fi

echo "Releasing pack-config-diff v$VERSION"
echo "Dry run: $DRY_RUN"

if [[ "$SKIP_TESTS" == false ]]; then
  echo "Running tests..."
  npm test
  echo "Building dist..."
  npm run build
else
  echo "Skipping tests/build checks."
fi

PUBLISH_ARGS=(publish --access public)
if [[ -n "$NPM_TAG" ]]; then
  PUBLISH_ARGS+=(--tag "$NPM_TAG")
fi
if [[ "$DRY_RUN" == true ]]; then
  PUBLISH_ARGS+=(--dry-run)
fi

echo "Running: npm ${PUBLISH_ARGS[*]}"
npm "${PUBLISH_ARGS[@]}"

if [[ "$DRY_RUN" == true ]]; then
  echo "Dry run complete. No tag created."
  exit 0
fi

git tag -a "v$VERSION" -m "v$VERSION"
git push origin "v$VERSION"

echo "Release complete: v$VERSION"
