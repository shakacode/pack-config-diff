# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/). Please use the existing headings and styling as a guide.
After a release, run `/update-changelog` in Claude Code to analyze commits, write entries, and create a PR.
Release and review helpers:

- Release docs: [docs/releasing.md](docs/releasing.md)
- Release scripts: [`scripts/release.sh`](scripts/release.sh), `npm run release:dry-run`, and `npm run release`
- Review workflows: [.claude/commands/address-review.md](.claude/commands/address-review.md), [commands/address-review.md](commands/address-review.md), and [.agents/workflows/address-review.md](.agents/workflows/address-review.md)

## [Unreleased]

## [v0.1.0] - 2026-04-02

### Added

- **Semantic config diff engine** for webpack and rspack projects, with support for objects, arrays, functions, RegExp, Date, class instances, ignore keys/paths, max depth, and path separators.
- **Plugin-aware comparison mode** for class-instance configs (`--plugin-aware`). [PR #1](https://github.com/shakacode/pack-config-diff/pull/1) by [justin808](https://github.com/justin808).
- **Module rule matching by test pattern** to reduce reorder noise (`--match-rules-by-test`). [PR #2](https://github.com/shakacode/pack-config-diff/pull/2) by [justin808](https://github.com/justin808).
- **Markdown output format** for PR-ready diff reports. [PR #3](https://github.com/shakacode/pack-config-diff/pull/3) by [justin808](https://github.com/justin808).
- **CLI** with `--left`/`--right`, `--format`, `--output`, `--plugin-aware`, `--match-rules-by-test`, and other options.
- **Programmatic API** via `DiffEngine` and `DiffFormatter` classes.
- **Cross-platform path normalization** and base-path detection.
- **Rich output formats**: detailed, summary, json, yaml, markdown.
- **Contextual documentation mapping** for common webpack/rspack config keys.
- **`prepare` script** for git installs so `dist/` builds automatically. [PR #5](https://github.com/shakacode/pack-config-diff/pull/5) by [justin808](https://github.com/justin808).
- **`diff` and `dump` now accept `--mode` for JS/TS config factories, making bundle mode selection explicit during config evaluation.** [PR #21](https://github.com/shakacode/pack-config-diff/pull/21) by [justin808](https://github.com/justin808).
- **`dump` now supports `--no-warn-env-label` to independently suppress build-matrix environment-label fallback notes.** [PR #25](https://github.com/shakacode/pack-config-diff/pull/25) by [justin808](https://github.com/justin808).

### Changed

- **CLI now uses diff-style exit codes: `0` for identical configs, `1` for differences found, and `2` for tool errors.** [PR #19](https://github.com/shakacode/pack-config-diff/pull/19) by [justin808](https://github.com/justin808).
- **`--no-warn-sensitive` now suppresses only sensitive-output warnings; environment-label warnings are controlled separately.** [PR #25](https://github.com/shakacode/pack-config-diff/pull/25) by [justin808](https://github.com/justin808).

### Fixed

- **`dump` now validates `--env` names, sanitizes YAML header metadata, and resolves export paths more safely.** [PR #21](https://github.com/shakacode/pack-config-diff/pull/21) by [justin808](https://github.com/justin808).
- **Removed development hook tooling from the published package and consumer install path to keep installs runtime-focused.** [PR #26](https://github.com/shakacode/pack-config-diff/pull/26) by [justin808](https://github.com/justin808).

[unreleased]: https://github.com/shakacode/pack-config-diff/compare/v0.1.0...HEAD
[v0.1.0]: https://github.com/shakacode/pack-config-diff/releases/tag/v0.1.0
