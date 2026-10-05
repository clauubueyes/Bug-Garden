# Architecture

This document describes the internal architecture of Bug Garden: modules, data flow,
storage, commit detection, plant generation and the extension ↔ webview bridge.

The authoritative description of *why* things are built this way lives in
[DECISIONS.md](DECISIONS.md).

## Design goals

1. **Pure domain logic.** Everything that decides *what plant a fix produces* is plain
   TypeScript with no `vscode` import, so it can be unit tested without an Extension Host.
2. **Thin adapters.** The only modules that know about VS Code APIs or `git` are thin
   wrappers that feed the domain with plain data.
3. **Reproducibility.** A commit always yields the same plant, regardless of when it is
   processed, of the machine, or of how many times it is processed.
4. **Local only.** No network calls, no telemetry, no source code leaves the machine.

## Module map

```text
src/
  extension.ts                 activation, wiring, lifecycle
  types/
    commit.ts                  CommitInfo and friends (plain data from git)
    plant.ts                   PlantSpecies, Rarity, PlantDefinition, PlantInstance
    garden.ts                  Garden, GardenStats, GardenSnapshot
  git/
    gitCli.ts                  safe `git` process runner (execFile, array args, timeout)
    commitParser.ts            raw `git log` output -> CommitInfo[]
    commitClassifier.ts        CommitInfo -> BugFixSignal (or nothing)
    commitWatcher.ts           detects HEAD movement in a workspace folder
  garden/
    plantDefinitions.ts        the plant catalogue (single source of truth)
    rarityCalculator.ts        commit features -> rarity score
    plantGenerator.ts          commit features + rarity -> PlantInstance (deterministic)
    gardenManager.ts           applies plants to a garden, dedupes, emits events
    gardenStats.ts             level, streak, rarest plant
  storage/
    storageService.ts          typed read/write over vscode Memento + JSON versioning
    migrations.ts              schema version upgrades
  humor/
    quips.ts                   personality strings, purely cosmetic
  webview/
    gardenView.ts              WebviewViewProvider (panel + message handling)
    gardenSerializer.ts        snapshot -> view model payload
    media/                     webview html/css/js assets
```

## Data flow

```text
  ┌──────────────┐   git log --numstat   ┌────────────────┐
  │ gitCli       │ ─────────────────────► │ commitParser   │
  │ (execFile)   │                        └────────┬───────┘
  └──────────────┘                                 │ CommitInfo[]
                                                   ▼
                                      ┌───────────────────────┐
                                      │ commitClassifier      │  is this a bug fix?
                                      └───────────┬───────────┘
                                                  │ BugFixSignal | null
                                                  ▼
                            ┌───────────────────────────────────────────┐
                            │ plantGenerator                           │
                            │  rarityCalculator(seeded by commit hash)   │
                            │  plantDefinitions (catalogue lookup)     │
                            └──────────────────┬────────────────────────┘
                                               │ PlantInstance
                                               ▼
                            ┌───────────────────────────────────────────┐
                            │ gardenManager  (dedupe by commit sha)    │
                            └──────────────────┬────────────────────────┘
                                               │ garden state change
                          ┌────────────────────┴────────────────────┐
                          ▼                                         ▼
             ┌───────────────────────┐                 ┌────────────────────┐
             │ storageService        │                 │ webview/gardenView  │
             │ (workspaceState)      │                 │ (postMessage)      │
             └───────────────────────┘                 └────────────────────┘
```

### 1. Reading history

`gitCli` runs `git` with an argument array (never a shell string), with `cwd` set to the
workspace folder and a hard timeout. It is the only place that spawns processes.

`commitParser` consumes `git log --numstat --no-merges --date=iso-strict -z` output and
produces `CommitInfo`:

```ts
interface CommitInfo {
    sha: string;          // full 40-char hash, the identity of the commit
    authorDate: string;   // ISO-8601 UTC
    subject: string;      // full message first line
    body: string;
    filesChanged: number;
    additions: number;
    deletions: number;
    paths: string[];      // repository-relative paths
    hasTests: boolean;    // paths look like tests
}
```

Only metadata that git already exposes is read. File contents are never read, so secrets
in `.env` files are never touched.

### 2. Deciding what is a bug fix

`commitClassifier` normalises the commit message (lowercase, strip conventional-commit
type/scope punctuation) and applies keyword rules:

| Kind           | Signals                                                        |
| -------------- | -------------------------------------------------------------- |
| Fix keyword    | `fix`, `bug`, `hotfix`, `resolve`, `resolved`, `patch`         |
| Excluded       | `fixup!`, `squash!`, `wip` with no other fix signal, revert-only |
| Feature keyword| `feat`, `refactor`, `chore`, `docs`, `style`, `test` alone      |

A commit that only carries a feature keyword is not a bug fix and grows nothing. Merge
commits are ignored (`--no-merges`), so rebases and PR merges do not spam the garden.

### 3. Generating a plant

`plantGenerator` is a pure function:

```ts
generatePlant(commit: CommitInfo): PlantInstance
```

- Every random decision is drawn from `mulberry32(seedFor(sha))`, a PRNG seeded with a
  hash of the commit SHA (plus the garden/project id where isolation matters).
- `rarityCalculator` turns commit features into a rarity score; `plantGenerator` selects
  the species from `plantDefinitions` whose `unlockCondition` matches, preferring the
  rarest eligible species first.
- Special conditions (night fixes, `fix: typo`, test-inclusive fixes, net deletions, large
  diffs) are expressed as data in `plantDefinitions.ts`, never as magic numbers spread
  through the code.

See [PLANT_SYSTEM.md](PLANT_SYSTEM.md) for the catalogue and the exact rules.

### 4. Applying to a garden

`gardenManager` is the only writer of garden state. It enforces the two invariants:

- **Idempotency:** a commit SHA already present in the garden is ignored, so re-scanning
  history or restarting VS Code cannot duplicate plants.
- **Determinism:** re-processing a commit with the same garden id returns the same plant.

It emits a typed event (`plantDiscovered`) that the extension layer forwards to the webview
and to the notification layer.

### 5. Persistence

`storageService` stores one JSON document per workspace in
`ExtensionContext.workspaceState`, under a key derived from the workspace folder URI:

```text
bugGarden.gardens  ->  { version: 1, gardens: { [projectKey]: Garden } }
```

- `globalState` holds cross-workspace settings and aggregate achievements.
- `workspaceState` holds the gardens, so they never touch the user's repository: no
  `.buggarden` file is created and nothing is staged by accident.
- The payload carries a `version`; `migrations.ts` upgrades older payloads on read, so a
  future schema change does not lose existing gardens.

### 6. Extension ↔ webview communication

`gardenView` owns a `WebviewView` in the `bugGarden` Activity Bar container.

- Extension → webview: `webview.postMessage({ type: 'garden/updated', payload })` with a
  plain snapshot produced by `gardenSerializer` (no VS Code types cross the boundary).
- Webview → extension: `onDidReceiveMessage` handles a small, explicit protocol
  (`garden/ready`, `plant/select`, `garden/refresh`, `garden/command`) validated with a type
  guard. Anything unknown is ignored.
- All HTML is generated with escaped strings; the webview loads only local resources with a
  per-session nonce and a strict Content Security Policy.