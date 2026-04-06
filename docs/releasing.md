# Releasing pack-config-diff

This project uses a changelog-driven release workflow. The target version is always read from `CHANGELOG.md` — there is no version argument. Update the changelog first, then run the release script.

For the first public release, keep `CHANGELOG.md` and `package.json` at `0.1.0`. The release script detects that `v0.1.0` is not tagged or published yet and allows that initial publish before the later Shakapacker-backed `1.0.0`.

## Prerequisites

1. **Actual release only**: `npm whoami` must succeed
2. **Actual release only**: `gh auth status` must succeed with write access
3. **Clean git on main**: `git status` must be clean, branch must be `main`

## Release Process

### 1. Update the Changelog

Update `CHANGELOG.md` with the target version header and entries.

**Option A — Use Claude Code (recommended):**

Run `/update-changelog release` to:

- Find merged PRs missing from the changelog
- Add entries under appropriate category headings
- Stamp the version header (e.g., `## [v1.1.0] - 2026-03-20`)
- Commit, push, and open a PR

Review and merge the PR.

**Option B — Manual:**

1. Move entries from `### [Unreleased]` to a new `## [vX.Y.Z] - YYYY-MM-DD` header
2. Update the `[unreleased]:` compare link at the bottom
3. Add a new version compare link
4. Commit and push to `main`

### 2. Run the Release Script

```bash
# Recommended: dry run first
npm run release:dry-run

# Actual release
npm run release
```

The script will:

1. Read the target version from the first `## [vX.Y.Z]` header in CHANGELOG.md
2. Compare to `package.json` and confirm one of three states:
   - `package.json` already matches the release version: proceed if that version is still unpublished
   - `package.json` is behind the changelog version: let `release-it` update `package.json` and `package-lock.json`
   - `package.json` is ahead of the changelog version: stop with an error until the files agree
   - when the version is already updated, the script passes the same-version flags to `release-it` so the first publish can still proceed
3. Run pre-flight checks (clean git, main branch, tag doesn't exist, and auth checks for actual releases)
4. Run `npm test` and `npm run build`
5. Show a summary and ask for confirmation
6. Run `npx release-it` to update `package.json` when needed, commit, tag, and publish to npm
7. Create a GitHub release from the CHANGELOG section via `gh`

### 3. Verify

- npm: https://www.npmjs.com/package/pack-config-diff
- GitHub releases: https://github.com/shakacode/pack-config-diff/releases

## Pre-release Versions

Use npm semver pre-release format in the CHANGELOG header:

```markdown
## [v2.0.0-rc.1] - 2026-04-01
```

The script auto-detects the pre-release suffix and publishes with `--npm.tag=next` instead of `latest`. Users install with:

```bash
npm install pack-config-diff@next
```

## What the Script Does

`scripts/release.sh` performs these steps:

1. Reads version from `CHANGELOG.md` (first `## [vX.Y.Z]` after `[Unreleased]`)
2. Compares the `CHANGELOG.md` version to `package.json` and either reuses it, bumps to it, or stops if `package.json` is already ahead
3. Detects pre-release (version contains `-`) and sets npm dist-tag accordingly
4. Checks npm publish state, retrying anonymously if local npm auth is broken
5. Pre-flight checks: clean git, main branch, no existing tag, and npm/gh auth for actual releases
6. Runs `npm test && npm run build` (skippable with `--skip-tests`)
7. Shows summary and prompts for interactive confirmation
8. Runs `npx release-it <version>` with CLI flags (no config file, no devDependency)
9. Creates GitHub release via `gh release create` with notes from CHANGELOG section

## Troubleshooting

**Version already exists on npm:**
Choose a different version in CHANGELOG.md and re-run.

**Dry run says npm auth is unavailable:**
That is safe for `npm run release:dry-run`. Re-run `npm login` before `npm run release`.

**Dry run says GitHub CLI auth is unavailable:**
That is safe for `npm run release:dry-run`. Re-run `gh auth login` before `npm run release`.

**npm publish failed after tag was created:**
Delete the tag (`git tag -d vX.Y.Z && git push origin :vX.Y.Z`), fix the issue, and re-run.

**GitHub release failed after npm publish:**
Run manually: `gh release create vX.Y.Z --title "vX.Y.Z" --notes "..."`

**Manual release fallback:**

```bash
# Bump version
npm version X.Y.Z --no-git-tag-version
git add package.json package-lock.json
git commit -m "Release vX.Y.Z"
git tag vX.Y.Z
git push && git push --tags

# Publish
npm publish

# GitHub release
gh release create vX.Y.Z --title "vX.Y.Z" --notes "Release notes here"
```
