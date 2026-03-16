# Releasing pack-config-diff

This project uses a changelog-driven release workflow. The target version is always read from `CHANGELOG.md` — there is no version argument. Update the changelog first, then run the release script.

## Prerequisites

1. **npm authentication**: `npm whoami` must succeed
2. **GitHub CLI**: `gh auth status` must succeed with write access
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
2. Compare to `package.json` — exit if already at that version
3. Run pre-flight checks (clean git, main branch, npm auth, gh auth, tag doesn't exist)
4. Run `npm test` and `npm run build`
5. Show a summary and ask for confirmation
6. Run `npx release-it` to bump `package.json`, commit, tag, and publish to npm
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
2. Compares to `package.json` version — exits if no release needed
3. Detects pre-release (version contains `-`) and sets npm dist-tag accordingly
4. Pre-flight checks: clean git, main branch, no existing tag, npm/gh auth
5. Runs `npm test && npm run build` (skippable with `--skip-tests`)
6. Shows summary and prompts for interactive confirmation
7. Runs `npx release-it <version>` with CLI flags (no config file, no devDependency)
8. Creates GitHub release via `gh release create` with notes from CHANGELOG section

## Troubleshooting

**Version already exists on npm:**
Choose a different version in CHANGELOG.md and re-run.

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
