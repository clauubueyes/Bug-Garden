# Decision record

Small architectural decision log for Bug Garden. Newest entries at the bottom.

Format: context, decision, reason, consequences. Trivial choices are not recorded; only the
ones that are expensive to reverse.

---

## ADR-001 — VS Code `workspaceState` for project gardens

**Status:** Accepted

**Decision**
Store project gardens in `ExtensionContext.workspaceState`, keyed by workspace folder.

**Reason**
Avoid adding files such as `.buggarden` to user repositories. Nothing that git tracks is
touched, so no project gets an accidental untracked file and no `.gitignore` entry is
needed.

**Consequences**
Gardens are local to the VS Code installation and its profile unless a future feature adds
synchronisation. Gardens are not shared between machines and are lost if the profile storage
is cleared. Storage also disappears if the user opens the project in a different window with
a different profile, which is acceptable for V1.

---

## ADR-002 — Read git through the `git` CLI, not the VS Code Git extension API

**Status:** Accepted

**Decision**
Spawn `git` with `execFile` (argument array, no shell) instead of consuming
`vscode.git` extension API.

**Reason**
The plant rules need per-commit additions, deletions and touched paths. The built-in Git
API does not expose those, so we would need the CLI anyway for part of the data. Using one
source for everything removes a dual code path and works even when the built-in Git
extension is disabled. It also avoids depending on a built-in extension's API shape.

**Consequences**
We own argument construction, output parsing and process timeouts. Commands are run with
`cwd` inside the workspace folder and never through a shell, so no user input is
interpreted as a shell command. Repository discovery uses `git rev-parse --show-toplevel`, and
every call runs with `GIT_OPTIONAL_LOCKS=0` so a read-only command cannot take the index lock
in a repository the user is working in. Classification only reads the commit subject, so the
commit body is not parsed in V1.

---

## ADR-003 — Zero runtime dependencies, Node's built-in test runner

**Status:** Accepted

**Decision**
The extension ships no runtime `dependencies`. Tests run on `node:test` with TypeScript
sources executed directly by Node's type stripping; only `typescript`, `eslint` and type
packages are installed.

**Reason**
Bug Garden's logic is small and self-contained: parsing, scoring, generating, serialising.
A test framework or a runtime utility library would add supply-chain surface and install
time for functionality we can write in a few dozen lines.

**Consequences**
Tests execute `.ts` files directly, which requires erasable-syntax-only TypeScript (no
enums, no namespaces, no parameter properties) and `import type` for type-only imports.
`@vscode/vsce` is not a dependency either; packaging uses `npx @vscode/vsce@latest`, so
`npm audit` stays clean at the cost of needing network access when packaging.

---

## ADR-004 — Plant generation is deterministic, seeded by the commit hash

**Status:** Accepted

**Decision**
All "random" plant decisions come from a PRNG seeded with a hash of the commit SHA.

**Reason**
The same commit must never produce different plants depending on when it was processed,
how many times, or on which machine. Re-scanning history after reinstalling the extension
has to reproduce the same garden.

**Consequences**
Rarity and species selection are reproducible but not truly random. If the rules change in
a later version, previously processed commits would generate different plants, so rule
changes must be versioned (`PLANT_RULES_VERSION`) if we ever want stable historical results.

---

## ADR-005 — Webview for the garden, TreeView only where lists are better

**Status:** Accepted

**Decision**
Render the garden as an HTML/CSS webview in the Activity Bar, not as a `TreeView`.

**Reason**
A garden is a visual, spatial representation: species need distinct shapes, rarity needs
colour and glow, and the summary needs a layout rather than a list of labels. A `TreeView`
can only produce rows of text.

**Consequences**
We take on webview responsibilities: CSP, nonce, message protocol, escaping and asset
loading. The webview is a separate UI layer that can be re-skinned without touching domain
logic, and it is unit-testable at the data level through `gardenSerializer`.

---

## ADR-006 — CommonJS build output, ESM-ish tooling everywhere else

**Status:** Accepted

**Decision**
Compile to CommonJS (`module: Node16` without `verbatimModuleSyntax`) because VS Code
loads extensions as CommonJS, while tests run the TypeScript sources natively.

**Reason**
`verbatimModuleSyntax` forbids ESM syntax in CommonJS files, which conflicts with the
VS Code requirement. Test files never ship, so keeping them out of the build
(`tsconfig.build.json`) avoids polluting `out/`.

**Consequences**
Imports in source files may omit file extensions (CommonJS resolution), and `.ts` extensions
are rewritten to `.js` on emit, which keeps the sources runnable by Node's type stripping.
Type-only imports are enforced by lint (`@typescript-eslint/consistent-type-imports`)
instead of by the compiler.

---

## ADR-007 — One garden per workspace folder, keyed by folder URI

**Status:** Accepted

**Decision**
Gardens are keyed by a stable hash of the workspace folder path inside a single
`workspaceState` document.

**Reason**
A multi-root workspace needs one garden per project, and the user asked for independent
gardens per workspace/project. A single JSON document keeps migrations simple (one version
field) while still allowing many gardens.

**Consequences**
Renaming or moving a folder makes the old garden unreachable (it stays in storage until
pruned). If we later need cross-window sharing, that requires moving gardens to `globalState`
keyed by a project identifier such as the git remote URL.