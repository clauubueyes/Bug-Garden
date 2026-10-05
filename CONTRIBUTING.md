# Contributing to Bug Garden

Thanks for helping grow the garden. Bug Garden is developed with the same discipline we ask
of its users: small changes, clear history, tests included.

## Ground rules

- `main` is stable. Never develop directly on it.
- One branch per logical change; do not mix large features.
- Every change ships with tests when there is logic to test, and with documentation updates.
- Run `npm run check` (types + lint + tests) before you consider a branch finished.

## Branch flow

```bash
git checkout main
git pull --ff-only
git checkout -b feat/my-change      # or fix/, docs/, refactor/, chore/, test/
# work, test, commit
git checkout main
git merge --no-ff feat/my-change -m "Merge branch 'feat/my-change'" -m "Short summary."
git branch -d feat/my-change
```

Branch naming: `feat/`, `fix/`, `docs/`, `refactor/`, `test/`, `chore/` followed by a short
kebab-case description of a single unit of work, e.g. `feat/plant-generator`. Branches that
belong to a roadmap phase may be prefixed with it, e.g. `phase3/storage-layer`, but keep the
scope single.

The roadmap in [README.md](README.md) defines the phases. Do not start the work of a phase
in the branch of another phase; if you find a bug that belongs elsewhere, note it as a TODO
or add it to the roadmap and handle it in its own branch later.

## Commit convention

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```text
<type>(optional scope): <short imperative description>
```

Types in use: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `perf`, `build`.

Good examples:

```text
feat: add garden sidebar view
feat: detect bug-fix commits
fix: prevent duplicated plants after reload
test: cover rarity calculation
docs: document garden generation rules
refactor: extract storage service
```

Rejected: `changes`, `update`, `stuff`, `final`, `fix things`.

If a feature has separable parts, split it into several commits (parser, classifier, tests,
docs). Every commit must build, lint and pass tests on its own.

## Running the project

```bash
npm install
npm run build        # compile to out/
npm run watch        # recompile on save
npm test             # tests only
npm run lint         # ESLint only
npm run check-types  # tsc --noEmit only
npm run check        # all three, in order
npm run package      # produce a .vsix with npx @vscode/vsce
```

Press <kbd>F5</kbd> to open an Extension Development Host running the extension.

## Running the tests

Tests use the Node.js built-in runner (`node:test`) on the TypeScript sources:

```bash
npm test                          # everything
node --test "src/garden/*.test.ts"   # a single area
node --test --test-name-pattern "rarity"  # filter by test name
```

Conventions:

- Test files live next to the code they cover: `plantGenerator.ts` → `plantGenerator.test.ts`.
- Prefer testing behaviour and boundaries, not implementation details.
- Anything that can run without VS Code must stay outside modules that import `vscode`.

## Adding a new plant

1. Open `src/garden/plantDefinitions.ts` and add an entry to the catalogue:

   ```ts
   {
       id: 'ghost-orchid',
       name: 'Ghost Orchid',
       rarity: 'epic',
       description: 'Blooms once a year, apparently in a timezone nobody uses.',
       glyph: 'orchid',
       unlockCondition: (features) => features.isNightFix && features.isLargeDiff,
       weight: 1,
   }
   ```

2. Use an existing condition helper from `src/garden/conditions.ts` when one fits; only add
   a new feature to `CommitFeatures` when the rule genuinely needs new data from the commit.
3. Register the glyph in the webview sprite map (`src/webview/media/glyphs.js`).
4. Add a test in `src/garden/plantGenerator.test.ts` (or `rarityCalculator.test.ts`) covering
   both the matching and the non-matching case. Determinism matters: assert that the same
   commit SHA always yields the same species.
5. Document the species and its condition in [docs/PLANT_SYSTEM.md](docs/PLANT_SYSTEM.md) and
   add an entry to `CHANGELOG.md`.

Rarities are fixed (`common`, `rare`, `epic`, `legendary`). Adding a new rarity means
updating `src/types/plant.ts`, the rarity scores in `rarityCalculator.ts` and the UI colours.

## Adding an achievement

1. Add the achievement definition to `src/achievements/achievementDefinitions.ts`
   (`id`, `title`, `description`, `check(garden, stats)`, `unlockedAt`).
2. Register it in `ACHIEVEMENT_IDS` so the unlock date can be persisted.
3. Add tests for `check()` covering the unlocking and the not-yet-unlocked case.
4. Render it in the achievements section of the webview and document it in
   [docs/PLANT_SYSTEM.md](docs/PLANT_SYSTEM.md).

Achievements must be derived from stored garden state only. They must not require network
access or any new git inspection.

## Code style

- TypeScript strict mode, no `any` (unknown plus narrowing instead), no non-null assertions.
- Small functions, single responsibility, no logic in `src/extension.ts` beyond wiring.
- Comments only where they explain *why* something is done, not what the code says.
- No new runtime dependency without an ADR explaining why an existing tool is not enough.
- No network calls, telemetry, or reading of file contents from the repository.

## Pull requests

Describe the change, the tests you added, and any documentation you updated. If you changed
an architectural decision, add or update the relevant entry in [docs/DECISIONS.md](DECISIONS.md)
and say what the old decision was, what you changed, and why.