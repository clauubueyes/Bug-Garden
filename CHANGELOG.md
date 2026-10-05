# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Plant domain: rarity tiers, the plant catalogue with unlock conditions, and a deterministic
  generator seeded by the commit hash.
- Commit feature extraction (night window, large/small diff, tests, net removals, typo, hotfix,
  revert, fixup) shared by every plant rule.
- Seeded PRNG helpers so the same commit always yields the same plant.
- `docs/PLANT_SYSTEM.md` documenting species, rarities, scoring and selection rules.

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