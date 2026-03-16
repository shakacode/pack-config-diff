# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/). Please use the existing headings and styling as a guide.
After a release, run `/update-changelog` in Claude Code to analyze commits, write entries, and create a PR.

## [Unreleased]

## [v1.0.0] - 2026-03-15

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

[unreleased]: https://github.com/shakacode/pack-config-diff/compare/v1.0.0...HEAD
[v1.0.0]: https://github.com/shakacode/pack-config-diff/releases/tag/v1.0.0
