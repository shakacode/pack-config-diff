# Releasing `pack-config-diff`

This guide is for maintainers publishing a new npm release.

## Prerequisites

1. You have publish rights for [`pack-config-diff`](https://www.npmjs.com/package/pack-config-diff).
2. You are logged in to npm:

   ```bash
   npm whoami
   ```

3. 2FA is enabled for your npm account (recommended/expected for publishing).

## 1) Update Version and Changelog

1. Ensure all intended PRs are merged to `main`.
2. Update `package.json` `version` to the target release (if needed).
3. Update `CHANGELOG.md`:
   - Add a new heading: `## [vX.Y.Z] - YYYY-MM-DD`
   - Move items from `Unreleased` into that version section.
   - Keep `## [Unreleased]` for next changes.
4. Commit and push those changes.

## 2) Run a Dry Run

```bash
npm run release:dry-run
```

This validates:

- clean git working tree
- current branch is `main`
- changelog contains a matching `## [v<package-version>]` heading
- tests/build pass
- npm publish packaging preview

## 3) Publish

```bash
npm run release
```

This will:

1. Validate working tree + branch + changelog/version consistency
2. Run `npm test`
3. Run `npm run build`
4. Publish to npm (`npm publish --access public`)
5. Create git tag `v<version>`
6. Push the tag to `origin`

## Optional Flags

You can run the script directly for advanced usage:

```bash
./scripts/release.sh --dry-run
./scripts/release.sh --npm-tag next
./scripts/release.sh --skip-tests
```

Notes:

- Use `--npm-tag next` for pre-release channels.
- `--skip-tests` should be used only in exceptional cases.

## Post-Release Checks

1. Verify npm package:
   - <https://www.npmjs.com/package/pack-config-diff>
2. Verify git tag on GitHub:
   - `vX.Y.Z`
3. Optionally create a GitHub release using the corresponding changelog section.
