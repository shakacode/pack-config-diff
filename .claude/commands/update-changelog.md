# Update Changelog

You are helping to add entries to the CHANGELOG.md file for the pack-config-diff project.

## Arguments

This command accepts an optional argument: `$ARGUMENTS`

- **No argument** (`/update-changelog`): Add entries to `[Unreleased]` without stamping a version header. Use this during development.
- **`release`** (`/update-changelog release`): Add entries and stamp a version header. Auto-compute the next version based on changes (breaking -> major, added features -> minor, fixes -> patch).
- **Explicit version** (`/update-changelog 1.2.0`): Add entries and stamp the exact version provided. The version string must look like semver (with optional `-rc.N` or `-beta.N` suffix).

## When to Use This

**During development** — Add entries to `[Unreleased]` as PRs merge:

- Run `/update-changelog` to find merged PRs missing from the changelog
- Entries accumulate under `## [Unreleased]`

**Before a release** — Stamp a version header and prepare for release:

- Run `/update-changelog release` (or an explicit version) to add entries AND stamp the version header
- After the PR merges, run `npm run release` — it reads the version from CHANGELOG.md

## Critical Requirements

1. **User-visible changes only**: Only add changelog entries for:
   - New features
   - Bug fixes
   - Breaking changes
   - Deprecations
   - Performance improvements
   - Security fixes
   - Changes to public APIs or configuration options

2. **Do NOT add entries for**:
   - Linting fixes
   - Code formatting
   - Internal refactoring
   - Test updates
   - Documentation fixes (unless they fix incorrect docs about behavior)
   - CI/CD changes

## Formatting Requirements

### Entry Format

Each changelog entry MUST follow this exact format:

```markdown
- **Bold description of change**. [PR #N](https://github.com/shakacode/pack-config-diff/pull/N) by [username](https://github.com/username).
```

**Important formatting rules**:

- Start with a dash and space: `- `
- Use **bold** for the main description
- End the bold description with a period before the link
- Always link to the PR: `[PR #N](https://github.com/shakacode/pack-config-diff/pull/N)`
- Always link to the author: `by [username](https://github.com/username)`
- End with a period after the author link

### Category Headings

Entries should be organized under these headings (most critical first):

1. `### Breaking Changes` — Breaking changes with migration notes
2. `### Added` — New features
3. `### Changed` — Changes to existing functionality
4. `### Fixed` — Bug fixes
5. `### Removed` — Removed features
6. `### Security` — Security-related changes

**Only include headings that have entries.**

## Auto-Computing the Next Version

When stamping a version header (`release` mode), compute the next version as follows:

1. **Find the latest version tag**:

   ```bash
   git tag -l 'v*' --sort=-v:refname | head -5
   ```

2. **Determine bump type from changelog content**:
   - If changes include `### Breaking Changes` -> **major** bump
   - If changes include `### Added` -> **minor** bump
   - If changes only include `### Fixed`, `### Security`, `### Changed`, `### Removed` -> **patch** bump
   - If there is no existing git tag and the package is not yet published to npm, keep the first public release at `0.1.0` even if unpublished work changed before launch

3. **Compute the version**: Apply the bump to the latest tag (e.g., `v1.0.0` + minor -> `v1.1.0`)

4. **Show the computed version to the user and ask for confirmation** before stamping. If the bump type is ambiguous, explain your reasoning and ask the user to confirm or override.

## Version Links

The CHANGELOG uses compare links at the bottom. The format is:

```markdown
[unreleased]: https://github.com/shakacode/pack-config-diff/compare/vX.Y.Z...HEAD
[vX.Y.Z]: https://github.com/shakacode/pack-config-diff/compare/vPREV...vX.Y.Z
```

When stamping a version, update these links:

1. Update `[unreleased]:` to compare from the new version to HEAD
2. Add a new version link comparing the previous version to the new version

## Process

### Step 1: Fetch and read current state

- **CRITICAL**: Run `git fetch origin main` to ensure you have the latest commits
- After fetching, use `origin/main` for all comparisons, NOT local `main` branch
- Read the current CHANGELOG.md to understand the existing structure

### Step 2: Find commits since last tag

1. Get the latest git tag: `git tag --sort=-v:refname | head -5`
2. List commits since last tag: `git log --oneline LAST_TAG..origin/main`
3. Extract PR numbers: `git log --oneline LAST_TAG..origin/main | grep -oE "#[0-9]+" | sort -u`
4. For each PR number, check if it's already in CHANGELOG.md: `grep "PR #XXX" CHANGELOG.md`

### Step 3: Add new entries

For PRs not yet in the changelog:

- Get PR details: `gh pr view NUMBER --json title,body,author --repo shakacode/pack-config-diff`
- **Never ask the user for PR details** — get them from git history or the GitHub API
- Validate that the change is user-visible (per the criteria above)
- Add the entry to `### [Unreleased]` under the appropriate category heading

### Step 4: Stamp version header (only when a version mode or explicit version is given)

If the user passed `release` or an explicit version string:

1. Compute or use the provided version
2. Insert `## [vX.Y.Z] - YYYY-MM-DD` header immediately after `## [Unreleased]`
3. Move all content from `[Unreleased]` to the new version section
4. Leave `### [Unreleased]` empty
5. Update the diff links at the bottom of the file

### Step 5: Verify and finalize

1. **Verify formatting**: Bold description with period, proper PR link, proper author link, file ends with newline
2. **Verify version sections are in order** (Unreleased -> newest tag -> older tags)
3. **Show the user** a summary of what was done
4. If in `release` or explicit-version mode, **automatically commit, push, and open a PR**:
   - Create a branch (e.g., `jg/changelog-v1.1.0`)
   - Commit CHANGELOG.md
   - Push and open a PR with the changelog diff
   - Remind the user to run `npm run release` after merge

## Examples

### Good Entry

```markdown
- **Plugin-aware comparison mode** for class-instance configs. [PR #1](https://github.com/shakacode/pack-config-diff/pull/1) by [justin808](https://github.com/justin808).
```

### Entry with Sub-bullets

```markdown
- **Rich output format support**: Added multiple output formats for different use cases:
  - `detailed` for human-readable console output
  - `markdown` for PR-ready diff reports
  - `json` and `yaml` for programmatic consumption
    [PR #3](https://github.com/shakacode/pack-config-diff/pull/3) by [justin808](https://github.com/justin808).
```
