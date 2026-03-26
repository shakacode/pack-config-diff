# Releasing `pack-config-diff`

This repository uses a changelog-driven local release flow modeled after Shakapacker:

- Update `CHANGELOG.md` with `/update-changelog`
- Merge to `main`
- Run the release from your command line with `release-it`

The release script reads the target version from the top versioned changelog header, bumps `package.json`, publishes npm, tags the release, pushes git metadata, and creates the GitHub release.

## Prerequisites

1. You have npm publish access for `pack-config-diff`.
2. You are authenticated locally with npm:

   ```bash
   npm whoami
   ```

3. You are authenticated locally with GitHub CLI:

   ```bash
   gh auth status
   ```

`release-it` uses git locally and the script will export `GITHUB_TOKEN` from `gh auth token` if needed for GitHub release creation.

## Stable Release Protocol

1. Ensure the intended PRs are merged.
2. Run:

   ```text
   /update-changelog release
   ```

3. Review the new top changelog version header, for example:

   ```text
   ## [v1.2.3] - 2026-03-25
   ```

4. Commit and push the changelog changes.
5. Merge that changelog PR to `main`.
6. From a clean local checkout on `main`, run:

   ```bash
   git switch main
   git pull --ff-only
   npm ci
   npm run release
   ```

The release script will:

1. Read the target version from `CHANGELOG.md`
2. Run tests/build
3. Bump `package.json` and `package-lock.json` via `release-it`
4. Commit the release bump
5. Create and push tag `vX.Y.Z`
6. Publish to npm with tag `latest`
7. Create the GitHub release

## Prerelease Protocol (`rc` / `beta`)

### Rules

- Do not manually edit `package.json` for release prep.
- Use `/update-changelog rc` or `/update-changelog beta`.
- Prerelease versions must use npm semver prerelease format:
  - `1.2.3-rc.0`
  - `1.2.3-beta.0`
- Prereleases publish to npm tag `next`.

### Steps

1. Run:

   ```text
   /update-changelog rc
   ```

   or:

   ```text
   /update-changelog beta
   ```

2. Confirm the top changelog header matches the intended prerelease version.
3. Commit and merge the changelog update to `main`.
4. From local `main`, run:

   ```bash
   git switch main
   git pull --ff-only
   npm ci
   npm run release
   ```

The script will detect the prerelease version and publish with npm dist-tag `next`.

## Dry Run

To validate the release without mutating git state or publishing:

```bash
npm run release:dry-run
```

## Optional Flags

You can also run the script directly:

```bash
./scripts/release.sh --dry-run
./scripts/release.sh --npm-tag next
./scripts/release.sh --skip-tests
```

## Release Engine

Release behavior is configured in:

- `.release-it.json`
- `scripts/release.sh`

## Post-Release Checks

1. Verify npm:
   - <https://www.npmjs.com/package/pack-config-diff>
2. Verify GitHub release:
   - <https://github.com/shakacode/pack-config-diff/releases>
3. Verify tag:
   - `vX.Y.Z`
