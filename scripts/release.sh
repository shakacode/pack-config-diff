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
  --dry-run         Validate and preview actions without mutating/publishing
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

echo "Preparing release:"
echo "  changelog version: v$TARGET_VERSION"
echo "  package.json version: v$CURRENT_VERSION"
echo "  npm tag: $EFFECTIVE_NPM_TAG"
echo "Dry run: $DRY_RUN"

if [[ "$SKIP_TESTS" == false ]]; then
  echo "Running tests..."
  npm test
  echo "Building dist..."
  npm run build
else
  echo "Skipping tests/build checks."
fi

if [[ "$DRY_RUN" == true ]]; then
  echo "Dry run complete. Planned actions:"
  echo "  1) npm version $TARGET_VERSION --no-git-tag-version"
  echo "  2) commit + push package version bump"
  echo "  3) npm publish --access public --tag $EFFECTIVE_NPM_TAG"
  echo "  4) git tag v$TARGET_VERSION and push tag"
  echo "  5) create GitHub release from changelog notes"
  exit 0
fi

if [[ -z "${NPM_TOKEN:-}" ]]; then
  echo "Error: NPM_TOKEN must be set for publishing." >&2
  exit 1
fi

echo "Bumping package.json version to $TARGET_VERSION..."
npm version "$TARGET_VERSION" --no-git-tag-version

git config user.name "${GIT_AUTHOR_NAME:-github-actions[bot]}"
git config user.email "${GIT_AUTHOR_EMAIL:-41898282+github-actions[bot]@users.noreply.github.com}"

git add package.json
if [[ -f package-lock.json ]]; then
  git add package-lock.json
fi

if ! git diff --cached --quiet; then
  git commit -m "chore(release): v$TARGET_VERSION [skip ci]"
  git push origin main
fi

PUBLISH_ARGS=(publish --access public --tag "$EFFECTIVE_NPM_TAG")
echo "Running: npm ${PUBLISH_ARGS[*]}"
npm "${PUBLISH_ARGS[@]}"

git tag -a "v$TARGET_VERSION" -m "v$TARGET_VERSION"
git push origin "v$TARGET_VERSION"

if command -v gh >/dev/null 2>&1; then
  RELEASE_NOTES_FILE="$(mktemp)"
  awk -v version="$TARGET_VERSION" '
    $0 ~ "^## \\[v"version"\\]" { in_section=1; next }
    in_section && $0 ~ "^## \\[v" { in_section=0 }
    in_section { print }
  ' CHANGELOG.md > "$RELEASE_NOTES_FILE"

  if [[ -s "$RELEASE_NOTES_FILE" ]]; then
    gh release create "v$TARGET_VERSION" \
      --title "v$TARGET_VERSION" \
      --notes-file "$RELEASE_NOTES_FILE"
  else
    gh release create "v$TARGET_VERSION" \
      --title "v$TARGET_VERSION" \
      --generate-notes
  fi
fi

echo "Release complete: v$TARGET_VERSION"
