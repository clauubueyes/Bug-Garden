# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Bug Garden view in the Activity Bar, rendered as a webview: garden summary, plant grid with
  rarity colours, and a details panel showing name, rarity, date, commit, project and the
  condition that unlocked it.
- Commands `Bug Garden: Open Garden View` and `Bug Garden: Refresh Garden`.
- Automatic scanning on activation and whenever `.git/HEAD` moves, with a multi-root project
  selector.
- Persistence: per-workspace gardens in `workspaceState`, keyed by a normalised workspace
  folder id, with a versioned store and tolerant validation that drops malformed entries
  instead of breaking activation.
- Git integration: repository discovery, bounded `git` process runner, NUL separated log
  parser, bug-fix classifier and a history reader that returns bug fixes oldest first.
- Duplicate protection: `gardenManager.applyCommits` converts each commit SHA into a plant at
  most once, so re-scans and restarts never duplicate plants.
- HEAD movement tracking with a debounced watcher, ready for the live scan in the UI layer.
- Plant domain: rarity tiers, the plant catalogue with unlock conditions, and a deterministic
  generator seeded by the commit hash.
- Commit feature extraction (night window, large/small diff, tests, net removals, typo, hotfix,
  revert, fixup) shared by every plant rule.
- Seeded PRNG helpers so the same commit always yields the same plant.
- `docs/PLANT_SYSTEM.md` documenting species, rarities, scoring and selection rules.

### Changed

- Classification reads the commit subject only, and treats `fixup!`, `squash!`, reverts and
  merge commits as non-fixes so rebases do not spam the garden.

## [0.1.0] - 2026-10-05

### Added

- Project bootstrap: TypeScript configuration for a VS Code extension, strict type
  checking and an ESLint flat config with type-aware rules.
- Test setup based on the Node.js built-in test runner, executing TypeScript sources
  directly, with no test framework dependency.
- Placeholder extension activation so the extension can be packaged and launched.
- Initial documentation: README, changelog and local development workflow.

[Unreleased]: https://github.com/clauubueyes/Bug-Garden/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/clauubueyes/Bug-Garden/releases/tag/v0.1.0