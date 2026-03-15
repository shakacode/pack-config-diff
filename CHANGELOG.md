# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

## [Unreleased]

### Added

- _No unreleased changes yet._

## [v1.0.0] - 2026-03-14

### Added

- Initial standalone extraction of the semantic webpack/rspack configuration diff engine from Shakapacker.
- CLI package and binstub: `pack-config-diff`.
- Deep diff engine with support for:
  - objects and arrays
  - functions, `RegExp`, and `Date`
  - class-instance-aware behavior for plugin-like objects
  - ignore keys/paths, max depth, and path separator options
- Cross-platform path normalization and base-path detection.
- Rich output formatter support:
  - `detailed`
  - `summary`
  - `json`
  - `yaml`
  - `markdown`
- Contextual documentation mapping for common webpack/rspack config keys.
- Comprehensive test suite ported from Shakapacker plus integration coverage.

### Improved

- Plugin-aware comparison mode for class-instance configs (`--plugin-aware`).
- Module rule matching by `rule.test` to reduce reorder noise (`--match-rules-by-test`).
- Markdown table output with escaping and deterministic entry sorting.

### Build

- Added `prepare` script so installs from GitHub build `dist/` automatically.
