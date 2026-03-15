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
  --dry-run         Run release-it in dry-run mode
  --skip-tests      Skip test/build checks (not recommended)
  --npm-tag <tag>   Override npm dist-tag (defaults: latest or next for prereleases)
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

TARGET_VERSION="$(grep -E '^## \[v[^]]+\]' CHANGELOG.md | grep -v 'Unreleased' | head -n1 | sed -E 's/^## \[v([^]]+)\].*/\1/')"
if [[ -z "$TARGET_VERSION" ]]; then
  echo "Error: could not find a version header in CHANGELOG.md (expected: ## [vX.Y.Z])." >&2
  exit 1
fi

CURRENT_VERSION="$(node -p "require('./package.json').version")"

if [[ "$TARGET_VERSION" == "$CURRENT_VERSION" ]]; then
  echo "No release needed: package.json already at v$CURRENT_VERSION."
  exit 0
fi

if ! grep -Fq "## [v$TARGET_VERSION]" CHANGELOG.md; then
  echo "Error: CHANGELOG.md is missing heading: ## [v$TARGET_VERSION]" >&2
  exit 1
fi

if git rev-parse -q --verify "refs/tags/v$TARGET_VERSION" >/dev/null; then
  echo "Error: git tag v$TARGET_VERSION already exists locally." >&2
  exit 1
fi

if git ls-remote --exit-code --tags origin "refs/tags/v$TARGET_VERSION" >/dev/null 2>&1; then
  echo "Error: git tag v$TARGET_VERSION already exists on origin." >&2
  exit 1
fi

if [[ -n "$NPM_TAG" ]]; then
  EFFECTIVE_NPM_TAG="$NPM_TAG"
elif [[ "$TARGET_VERSION" == *-* ]]; then
  EFFECTIVE_NPM_TAG="next"
else
  EFFECTIVE_NPM_TAG="latest"
fi

echo "Preparing release (release-it):"
echo "  changelog version: v$TARGET_VERSION"
echo "  package.json version: v$CURRENT_VERSION"
echo "  npm tag: $EFFECTIVE_NPM_TAG"
echo "Dry run: $DRY_RUN"

if [[ "$DRY_RUN" == false ]] && [[ -z "${NPM_TOKEN:-}" ]]; then
  echo "Error: NPM_TOKEN must be set for publishing." >&2
  exit 1
fi

if [[ "$DRY_RUN" == false ]] && [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "Error: GITHUB_TOKEN must be set for GitHub release creation." >&2
  exit 1
fi

RELEASE_IT_ARGS=(
  "$TARGET_VERSION"
  "--ci"
  "--npm.tag=$EFFECTIVE_NPM_TAG"
)

if [[ "$DRY_RUN" == true ]]; then
  RELEASE_IT_ARGS+=("--dry-run")
fi

if [[ "$SKIP_TESTS" == true ]]; then
  export SKIP_RELEASE_TESTS=true
  echo "Skipping tests/build checks (SKIP_RELEASE_TESTS=true)."
fi

echo "Running: npx release-it ${RELEASE_IT_ARGS[*]}"
npx release-it "${RELEASE_IT_ARGS[@]}"

if [[ "$DRY_RUN" == true ]]; then
  echo "Dry run complete."
else
  echo "Release complete: v$TARGET_VERSION"
fi
