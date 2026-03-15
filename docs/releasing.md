# Releasing `pack-config-diff`

This repository uses a changelog-driven release flow modeled after Shakapacker:

- You update `CHANGELOG.md` via `/update-changelog`.
- You commit and push to `main`.
- CI runs the release script (powered by `release-it`), bumps `package.json`, publishes npm, tags, and creates the GitHub release.

## Prerequisites

1. Repository has `NPM_TOKEN` configured in GitHub Actions secrets.
2. Repository has `GITHUB_TOKEN` available to the workflow (default Actions token is used).
3. Maintainer has permissions to merge to `main`.
4. You have `/update-changelog` available in your workflow.

## Stable Release Protocol

1. Ensure release-ready PRs are merged.
2. Run:

   ```text
   /update-changelog release
   ```

3. Review `CHANGELOG.md` for the new top version header (for example `## [v1.2.3] - YYYY-MM-DD`).
4. Commit and push only changelog/documentation changes.
5. Merge/push to `main`.

That push triggers `.github/workflows/release-on-main.yml`, which executes `./scripts/release.sh` and will:

1. Read target version from the top changelog version header.
2. Bump `package.json` (and `package-lock.json`) to that version.
3. Run tests/build.
4. Commit/push the version bump to `main`.
5. Publish to npm (`latest` for stable).
6. Create/push tag `vX.Y.Z`.
7. Create GitHub release via `release-it`.

Release behavior is configured in:

- `.release-it.json`
- `scripts/release.sh`

## Prerelease Protocol (`rc` / `beta`)

### Rules

- Do not manually edit `package.json` version for release prep.
- Use `/update-changelog rc` or `/update-changelog beta` to produce prerelease headers.
- Prerelease versions must use npm semver prerelease format:
  - `1.2.3-rc.0`
  - `1.2.3-beta.0`

### Steps

1. Run:

   ```text
   /update-changelog rc
   ```

   or

   ```text
   /update-changelog beta
   ```

2. Confirm top changelog header is prerelease, e.g. `## [v1.2.3-rc.0] - YYYY-MM-DD`.
3. Commit and push changelog changes.
4. Merge/push to `main`.

Release automation will detect prerelease version and publish to npm dist-tag `next` automatically.

## Dry Run / Local Verification (Optional)

You can validate locally without publishing:

```bash
npm run release:dry-run
```

This checks branch, changelog/version state, and test/build readiness, and prints planned release actions.

## Post-Release Checks

1. npm package version/dist-tag:
   - <https://www.npmjs.com/package/pack-config-diff>
2. Git tag exists:
   - `vX.Y.Z`
3. GitHub release exists:
   - <https://github.com/shakacode/pack-config-diff/releases>
