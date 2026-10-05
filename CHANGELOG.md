# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Illustrated, interactive garden with eleven original species drawings, greenhouse scenery,
  day/night switching, plant selection, cosmetic watering, drag and drop, and keyboard-friendly
  arrangement. Plant placement and atmosphere are saved independently for each project.
- `Bug Garden: Open Full Garden` opens the garden in an editor tab; both views stay in sync.
- Searchable species collection with rarity filters and unlock hints, milestone details,
  commit-hash copying, and an actionable empty workspace screen.
- Browser interaction checks (`npm run test:ui`) using local Chromium, including narrow
  layouts, persistence, keyboard focus, reduced motion and safe rendering of commit text.
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

### Fixed

- The garden view resolves its active project from the currently open folders, including
  when a previous selection is missing or its folder has been removed.
- Folders added after activation are registered before scanning their Git history.
- Local debugging opens the extension repository through a separate `.code-workspace` file,
  avoiding VS Code skipping a folder that is already open in the editor window.
- Rarest-plant summaries include the rarity identifier used by the webview, so rendering
  a populated garden no longer fails when building the rarest-plant card.

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
