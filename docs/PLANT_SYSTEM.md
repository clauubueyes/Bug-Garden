# Plant system

Everything in this document is implemented in `src/garden/plantDefinitions.ts`,
`src/garden/rarityCalculator.ts` and `src/garden/plantGenerator.ts`. There are no magic
values scattered elsewhere: if a rule changes, it changes here.

## Rarities

| Rarity     | Tier index | Rough score band | Meaning                                  |
| ---------- | ---------- | --------------- | ---------------------------------------- |
| `common`   | 0          | 0 – 7           | Routine fixes. Honest work.              |
| `rare`     | 1          | 8 – 17          | Something about this fix was notable.    |
| `epic`     | 2          | 18 – 29         | Big, unusual, or after-hours.            |
| `legendary`| 3          | 30+             | Once in a career.                        |

## Rarity calculation

Rarity is a score, not a coin flip. Feature rules add or subtract points, and a small seeded
jitter (0–6, derived from the commit SHA) breaks ties so two identical fixes do not always
produce the same tier.

| Rule id           | Points | Condition                                          |
| ----------------- | ------ | -------------------------------------------------- |
| `hotfix`          | +12    | Commit subject matches `hotfix`                    |
| `large-diff`      | +10    | ≥ 5 files changed, or ≥ 200 changed lines          |
| `night-fix`       | +14    | Committed between 00:00 and 04:00 UTC              |
| `test-coverage`   | +8     | The diff touches tests                             |
| `net-removal`     | +6     | More lines deleted than added                      |
| `small-diff`      | −4     | ≤ 2 files and ≤ 20 changed lines                   |

The total is clamped at 0 before the jitter is added. Thresholds: 8 → rare, 18 → epic,
30 → legendary.

**Determinism.** The jitter comes from `createSeededRandom(`${sha}:rarity`)`, so a commit
always scores the same, no matter when it is processed or on which machine.

## Species

| Species        | Rarity    | Unlock condition                              | Weight | Condition label                     |
| -------------- | --------- | --------------------------------------------- | ------ | ----------------------------------- |
| Sprout         | common    | always                                        | 3      | Any bug fix will do                  |
| Tulip          | common    | small diff                                    | 3      | A small, contained fix               |
| Sunflower      | common    | diff touches tests                            | 4      | The fix came with tests              |
| Fern           | common    | more lines added than removed                 | 2      | More added than removed              |
| Cactus         | rare      | tests **and** small diff                      | 3      | Small fix backed by tests            |
| Mushroom       | rare      | night fix                                     | 3      | Committed between 00:00 and 04:00 UTC |
| Lotus          | rare      | large diff **and** tests                      | 2      | Large fix with tests                 |
| Monstera       | epic      | 8 or more files touched                       | 1      | Eight files or more in one fix       |
| Ghost Orchid   | epic      | night fix **and** large diff                  | 1      | Night fix across many files          |
| Ancient Oak    | legendary | large diff **and** tests **and** additions > deletions | 1 | Large, test covered addition |
| Sakura         | legendary | deletions > additions                         | 1      | More lines removed than added        |

## How a plant is selected

1. `extractFeatures(commit)` turns the commit into the `CommitFeatures` above.
2. `calculateRarity(features)` returns the tier, the score and the reasons that produced it.
3. `selectDefinition` collects every species in that tier whose `unlockCondition` holds and
   picks one proportionally to `weight`, using a random source seeded with the commit SHA.
4. If a tier has no eligible species, the generator steps down one tier at a time. It never
   returns nothing: every valid bug fix grows exactly one plant.

Species conditions are **hard** requirements (a plant cannot appear when its condition is
false). Weights are **soft** (they shape the odds inside a tier). That split is why
`fix: typo`-style commits stay in the common tier while Sunflower is simply the most likely
common plant when tests are involved.

## Special rules

- **Typo fixes** are handled by weight rather than by a dedicated species: `fix: typo`
  produces a small common plant.
- **Net removals** are the only route to Sakura, and the main reason epic or legendary
  commits drift towards "we deleted the bug".
- **Time of day** is read in UTC so a garden looks the same in every timezone.
- **Merge commits are ignored** at the git layer, so rebases and PR merges never grow plants.

## Adding a new species

See [CONTRIBUTING.md](../CONTRIBUTING.md#adding-a-new-plant). In short: add the definition to
`PLANT_DEFINITIONS`, reuse the predicates in `src/garden/conditions.ts`, cover the matching
and non-matching cases in `plantDefinitions.test.ts`, add a glyph to the webview sprite map,
and update the table above plus `CHANGELOG.md`.