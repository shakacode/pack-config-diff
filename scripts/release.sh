#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

DRY_RUN=false
SKIP_TESTS=false
INITIAL_RELEASE=false

usage() {
  cat <<'EOF'
Usage: scripts/release.sh [options]

Changelog-driven release script for pack-config-diff.
Reads the target version from CHANGELOG.md and publishes to npm.

Options:
  --dry-run       Run release-it in dry-run mode (no publish, no tag, no push)
  --skip-tests    Skip test and build checks (not recommended)
  -h, --help      Show this help message

The release version is always read from CHANGELOG.md — there is no version argument.
Update CHANGELOG.md first, then run this script.
EOF
}

log_info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

confirm() {
  local prompt="$1"
  echo -en "${BOLD}${prompt} [y/N] ${NC}"
  read -r answer </dev/tty
  case "$answer" in
    [yY]|[yY][eE][sS]) return 0 ;;
    *) echo "Aborted."; exit 1 ;;
  esac
}

# ── Parse arguments ──────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)    DRY_RUN=true; shift ;;
    --skip-tests) SKIP_TESTS=true; shift ;;
    -h|--help)    usage; exit 0 ;;
    *) log_error "Unknown option: $1"; usage; exit 1 ;;
  esac
done

# ── Read version from CHANGELOG.md ──────────────────────────────────────────

parse_version_from_changelog() {
  local header
  header=$(grep -m1 -E '^## \[v[0-9]' CHANGELOG.md || true)

  if [[ -z "$header" ]]; then
    log_error "No version header found in CHANGELOG.md (expected: ## [vX.Y.Z] - YYYY-MM-DD)"
    exit 1
  fi

  RELEASE_VERSION=$(echo "$header" | sed -E 's/^## \[v([^]]+)\].*/\1/')
  RELEASE_DATE=$(echo "$header" | sed -E 's/.*\] - ([0-9]{4}-[0-9]{2}-[0-9]{2}).*/\1/')
  log_info "CHANGELOG version: v${RELEASE_VERSION} (${RELEASE_DATE})"
}

# ── Read current version from package.json ───────────────────────────────────

parse_current_version() {
  CURRENT_VERSION=$(node -p "require('./package.json').version")
  PACKAGE_NAME=$(node -p "require('./package.json').name")
  log_info "package.json version: ${CURRENT_VERSION}"
}

# ── Compare versions ─────────────────────────────────────────────────────────

version_tag_exists() {
  if git rev-parse "v${RELEASE_VERSION}" >/dev/null 2>&1; then
    return 0
  fi

  git ls-remote --exit-code --tags origin "refs/tags/v${RELEASE_VERSION}" >/dev/null 2>&1
}

version_published_to_npm() {
  local output

  if output=$(npm view "${PACKAGE_NAME}@${RELEASE_VERSION}" version --json 2>&1); then
    return 0
  fi

  if echo "$output" | grep -q 'E404'; then
    return 1
  fi

  if echo "$output" | grep -qE 'E401|E403|ENEEDAUTH'; then
    log_error "npm authentication error while checking publish state. Run 'npm login' first."
    echo "$output" >&2
    exit 1
  fi

  log_error "Unable to verify npm publish state for ${PACKAGE_NAME}@${RELEASE_VERSION}."
  echo "$output" >&2
  exit 1
}

check_version_differs() {
  if [[ "$RELEASE_VERSION" == "$CURRENT_VERSION" ]]; then
    if version_tag_exists || version_published_to_npm; then
      log_info "No release needed — v${RELEASE_VERSION} is already tagged or published."
      exit 0
    fi

    INITIAL_RELEASE=true
    log_info "Initial release detected — package version matches CHANGELOG.md, but v${RELEASE_VERSION} is not tagged or published yet."
    return
  fi

  if version_tag_exists || version_published_to_npm; then
    log_error "Release version v${RELEASE_VERSION} already exists as a tag or published npm version."
    exit 1
  fi
}

# ── Detect prerelease ────────────────────────────────────────────────────────

detect_npm_tag() {
  if [[ "$RELEASE_VERSION" == *-* ]]; then
    NPM_TAG="next"
    log_info "Prerelease detected — npm dist-tag: next"
  else
    NPM_TAG="latest"
  fi
}

# ── Pre-flight checks ───────────────────────────────────────────────────────

preflight_checks() {
  echo ""
  log_info "Running pre-flight checks..."

  if ! git diff --quiet || ! git diff --cached --quiet; then
    log_error "Git working tree must be clean. Commit or stash changes first."
    exit 1
  fi
  echo "  ✓ Clean working tree"

  local branch
  branch=$(git branch --show-current)
  if [[ "$branch" != "main" ]]; then
    log_error "Releases must be run from main (current: ${branch})."
    exit 1
  fi
  echo "  ✓ On main branch"

  # version_tag_exists already confirmed false in check_version_differs — skip redundant network call
  echo "  ✓ Tag v${RELEASE_VERSION} does not exist"

  if ! npm whoami >/dev/null 2>&1; then
    log_error "Not logged in to npm. Run 'npm login' first."
    exit 1
  fi
  echo "  ✓ Logged in to npm as: $(npm whoami)"

  if ! gh auth status >/dev/null 2>&1; then
    log_error "Not authenticated with GitHub CLI. Run 'gh auth login' first."
    exit 1
  fi
  echo "  ✓ GitHub CLI authenticated"
}

# ── Run tests ────────────────────────────────────────────────────────────────

run_tests() {
  if [[ "$SKIP_TESTS" == true ]]; then
    log_warn "Skipping tests (--skip-tests)."
    return
  fi
  echo ""
  log_info "Running tests and build..."
  npm test
  npm run build
  log_info "Tests and build passed."
}

# ── Show summary and confirm ─────────────────────────────────────────────────

show_summary_and_confirm() {
  echo ""
  echo "════════════════════════════════════════════════════════════════"
  echo -e "  ${BOLD}Release Summary${NC}"
  echo "════════════════════════════════════════════════════════════════"
  echo "  Current version:  ${CURRENT_VERSION}"
  echo "  Release version:  ${RELEASE_VERSION}"
  echo "  npm dist-tag:     ${NPM_TAG}"
  echo "  Initial release:  ${INITIAL_RELEASE}"
  echo "  Dry run:          ${DRY_RUN}"
  echo "════════════════════════════════════════════════════════════════"
  echo ""

  if [[ "$DRY_RUN" == true ]]; then
    log_info "DRY RUN — no changes will be made."
  else
    confirm "Proceed with release v${RELEASE_VERSION}?"
  fi
}

# ── Run release-it ───────────────────────────────────────────────────────────

do_release() {
  echo ""
  log_info "Running release-it..."

  local -a args=(
    "${RELEASE_VERSION}"
    "--npm.publish"
    "--npm.tag=${NPM_TAG}"
    "--no-git.requireCleanWorkingDir"
    "--no-github.release"
    "--git.tagName=v\${version}"
    "--git.commitMessage=Release v\${version}"
    "--git.tagAnnotation=Release v\${version}"
  )

  if [[ "$INITIAL_RELEASE" == true ]]; then
    args+=("--npm.skipChecks" "--npm.ignoreVersion")
  fi

  if [[ "$DRY_RUN" == true ]]; then
    args+=("--dry-run" "--verbose" "--ci")
  fi

  echo "  npx release-it ${args[*]}"
  npx release-it "${args[@]}"
}

# ── Extract changelog section ────────────────────────────────────────────────

extract_changelog_section() {
  # Extract text between ## [vVERSION] and the next ## [ header,
  # stripping footer link references and trailing blank lines.
  awk '
    /^## \[v'"${RELEASE_VERSION}"'\]/ { found=1; next }
    /^## \[/ { if (found) exit }
    found && /^\[.+\]:/ { next }
    found { print }
  ' CHANGELOG.md | awk 'NF{p=1} p' | awk '{lines[NR]=$0} END{for(i=NR;i>0;i--) if(lines[i]!=""){last=i;break} for(i=1;i<=last;i++) print lines[i]}'
}

# ── Create GitHub release ────────────────────────────────────────────────────

create_github_release() {
  if [[ "$DRY_RUN" == true ]]; then
    log_info "DRY RUN: Would create GitHub release v${RELEASE_VERSION}"
    echo "  Release notes:"
    extract_changelog_section | head -20
    return
  fi

  echo ""
  log_info "Creating GitHub release..."

  local notes
  notes=$(extract_changelog_section)

  if [[ -z "$notes" ]]; then
    log_warn "No changelog section found for v${RELEASE_VERSION}. Creating release without notes."
    gh release create "v${RELEASE_VERSION}" --title "v${RELEASE_VERSION}" --notes ""
  else
    gh release create "v${RELEASE_VERSION}" --title "v${RELEASE_VERSION}" --notes "$notes"
  fi

  log_info "GitHub release created: v${RELEASE_VERSION}"
}

# ── Main ─────────────────────────────────────────────────────────────────────

main() {
  echo ""
  echo -e "${BOLD}pack-config-diff release${NC}"
  echo ""

  parse_version_from_changelog
  parse_current_version
  check_version_differs
  detect_npm_tag
  preflight_checks
  run_tests
  show_summary_and_confirm
  do_release
  create_github_release

  echo ""
  echo "════════════════════════════════════════════════════════════════"
  if [[ "$DRY_RUN" == true ]]; then
    echo -e "  ${GREEN}${BOLD}DRY RUN COMPLETE${NC}"
  else
    echo -e "  ${GREEN}${BOLD}RELEASE COMPLETE: v${RELEASE_VERSION}${NC}"
    echo ""
    echo "  npm: https://www.npmjs.com/package/pack-config-diff"
    echo "  GitHub: https://github.com/shakacode/pack-config-diff/releases"
  fi
  echo "════════════════════════════════════════════════════════════════"
  echo ""
}

main
