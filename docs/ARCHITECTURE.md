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
    historyReader.ts           git log + parser + classifier -> bug-fix commits
    headTracker.ts             detects HEAD movement for one repository
    commitWatcher.ts           VS Code file watcher that drives the head tracker
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
workspace folder, `GIT_OPTIONAL_LOCKS=0` (read-only commands must not take the user's index
lock) and a hard timeout. It is the only place that spawns processes.

`historyReader` is the service the extension uses. It asks `gitCli` for
`git log --no-merges --numstat -z --date=iso-strict`, hands the raw output to `commitParser`,
reverses the result (git returns newest first, a garden grows oldest first) and keeps only
the commits `commitClassifier` accepts. The reader takes the runner as a parameter, so its
behaviour is unit tested against fixtures instead of a real repository.

`commitParser` consumes NUL separated records and produces `CommitInfo`:

```ts
interface CommitInfo {
    sha: string;          // full 40-char hash, the identity of the commit
    authorDate: string;   // ISO-8601 as git reports it, with offset
    subject: string;      // full message first line
    body: string;         // empty in V1; the body is not parsed
    filesChanged: number;
    additions: number;
    deletions: number;
    paths: string[];      // repository-relative paths
    hasTests: boolean;    // paths look like tests
    isMerge: boolean;     // merges never reach the parser (--no-merges)
}
```

Only metadata that git already exposes is read. File contents are never read, so secrets
in `.env` files are never touched.

### 2. Deciding what is a bug fix

`commitClassifier` normalises the commit subject (lowercase, strip conventional-commit
type/scope punctuation) and applies keyword rules. Only the subject is inspected: a commit
never has to be re-read to be classified, and nothing from the body can smuggle in a
decision.

| Kind           | Signals                                                        |
| -------------- | -------------------------------------------------------------- |
| Fix keyword    | `fix`, `bug`, `hotfix`, `resolve`, `resolved`, `patch`         |
| Compound type  | `bugfix:` counts as both `bug` and `fix`                       |
| Excluded       | `fixup!`, `squash!`, reverts, merge commits, empty subjects     |

A commit that only carries a feature keyword (`feat:`, `refactor:`, `chore:`, `docs:`) is not
a bug fix and grows nothing. Merge commits are excluded at the query level (`--no-merges`), so
rebases and PR merges do not spam the garden.

### 3. Generating a plant

`plantGenerator` is a pure function:

```ts
generatePlant(commit: CommitInfo, projectId: string): PlantInstance
```

- Every random decision is drawn from a PRNG seeded with a hash of the commit SHA.
- `rarityCalculator` turns commit features into a rarity score; `plantGenerator` picks a
  species from `plantDefinitions` whose `unlockCondition` holds, weighted by `weight`, and
  steps down a tier when a tier has no eligible species.
- Special conditions (night fixes, `fix: typo`, test-inclusive fixes, net deletions, large
  diffs) are expressed in `plantDefinitions.ts` and `rarityCalculator.ts`, never as magic
  numbers spread through the code.

See [PLANT_SYSTEM.md](PLANT_SYSTEM.md) for the catalogue and the exact rules.

### 4. Applying to a garden

`gardenManager` is the only writer of garden state. It exposes a pure `applyCommits(garden,
commits, now)` that returns a new garden plus the plants it granted, enforcing two
invariants:

- **Idempotency:** a commit SHA already in `processedCommits` is skipped, so re-scanning
  history or restarting VS Code cannot duplicate plants.
- **Determinism:** re-processing a commit returns the same plant, because the generator only
  depends on the commit.

The extension layer watches `.git/HEAD` through `commitWatcher`, debounces the events, and
asks `HeadTracker` whether HEAD actually moved before triggering a scan.

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