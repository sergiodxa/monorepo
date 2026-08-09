# ADR-009: v1 TypeScript Implementation of the Spec Runtime

## Status

**Proposed** - 2026-08-08

This ADR plans the first implementation of the system designed by
[ADR-001](./ADR-001-executable-specification-language.md) through
[ADR-008](./ADR-008-environments-and-compatibility.md). Unlike those eight,
this document is deliberately not standalone: it describes how the runtime
lands in this monorepo, and it may reference the monorepo's packages and
conventions. The design suite remains the behavioral authority; nothing here
upgrades a design-suite **Open** item into a design decision. Where v1 must
pick an answer to ship, the pick is recorded below as **v1 provisional** —
binding on this implementation, invisible to the design record, and cheap to
revisit.

## Context

The design suite is complete and internally consistent, but it was written to
be learnable, not runnable. Three of its properties shape this plan:

1. Every `.spec` snippet in the suite is Illustrative — a canonical teaching
   notation. v1 implements exactly that notation, so every example in
   ADR-001…008 becomes executable as written (within v1's capability scope).
2. Roughly fifty questions are genuinely Open. An implementation cannot defer
   them all; the ones on v1's critical path get provisional answers here.
3. The owner's acceptance criterion is dogfooding: once a minimal version
   exists and the syntax is defined, the tool's own behavioral suite is
   written in `.spec` files and executed by the tool — the spec CLI is itself
   a CLI application, exactly what the `fs` and `cli` capability families
   specify.

## Decision

### 1. Location and shape

A new workspace package **`packages/spec`** (`@pkg/spec`), following the
monorepo's package conventions: TypeScript sources exported directly, tsconfig
extending the root, `bun:test` files colocated in `src/`, `@pkg/result` for
every fallible function (parse errors, permission denials, and tool failures
are values, never throws), full JSDoc per the repository documentation rules.
The package declares a binary:

```jsonc
"bin": { "spec": "./src/cli.ts" }
```

with a `#!/usr/bin/env bun` shebang, so `bun spec run …` works anywhere in the
workspace. Test failures are outcomes, not errors: a failing expectation is a
reported result, and the process exit code (0 pass / 1 fail / 2 usage or load
error) is the CLI's contract.

### 2. v1 scope

| In v1                                                                        | Deferred                                        |
| ---------------------------------------------------------------------------- | ----------------------------------------------- |
| Lexer + parser for the full canonical notation (below)                       | `feature`, `app` constructs (Open in the suite) |
| Suite loader: `spec/`, two-pass definition loading, duplicate detection      | Modules/imports, package-level sharing          |
| Executor: `test`, `given`/`when`/`then`, `let`, `return`, commands, fixtures | Fixture lifecycle hooks (cleanup/teardown)      |
| `expect` (equality + observable forms) and `eventually [within d]`           | Richer matchers, `then` purity restrictions     |
| Isolated per-test workspace (temp dir, auto-cleanup, path safety)            | Containers/VM workspace backends                |
| Permissions: deny-by-default, `--allow-run/net/env/host-fs` with scopes      | `--allow-device`, plugin sandboxing             |
| Capabilities: `fs`, `cli`, `http` as built-in plugins                        | `browser`, `ios`, `android`, desktop            |
| Plugin protocol: typed tool descriptors + NDJSON-over-stdio transport        | Version/capability negotiation, remote plugins  |
| Structured diagnostics + human reporter (incl. permission denials)           | Traces, screenshots, reporter formats           |
| Dogfood suite: `packages/spec/spec/*.spec` specifying the CLI itself         | Environments mechanism (see §5)                 |

The browser family is the largest omission and is deliberate: it forces an
automation-technology choice the design suite worked hard to keep out of the
core, and nothing about adding it later disturbs v1 — it is one more plugin
behind the same protocol.

### 3. The v1 grammar (v1 provisional)

The precise grammar lives in `packages/spec/GRAMMAR.md` and is the normative
reference for the lexer and parser. Summary of the shape:

- Line-oriented statements; `{ … }` blocks; `#` line comments; significant
  newlines terminate statements (no semicolons).
- Literals: `"strings"` with escapes, `"""multiline"""` with common-indent
  stripping, integers/floats, `true`/`false`, durations (`10s`, `500ms`,
  parsed with `@pkg/duration`), object literals `{ key: expr, … }` with
  newline or comma separators.
- Expressions: literals, dotted references (`user.email`), `fixture NAME`,
  and invocations (`run "node" "index.js"`, `http.post "/x" { … }`).
  A bare identifier in argument position is a _word_ — a symbol the tool's
  descriptor interprets (`click button "Sign in"`, `expect file "x" exists`).
- Definitions: `command NAME(params) { … }`, `command NAME { … }`,
  `fixture NAME { … }`; `test "title" { given { } when { } then { } }` with
  phases optional but strictly ordered.
- `use NAMESPACE` imports a namespace's tools as unqualified names; ambiguity
  is an error reported where the name is used, never a guess (per GRAMMAR.md's
  static rules — the qualified `ns.tool` form is always available). **`use` is
  file-scoped** (the design suite's Direction, adopted for v1).
- `eventually [within DURATION] { … }` is valid only inside `then`.
- No `if`, no loops, no `switch`, no `match` — the parser rejects them by
  having no productions for them.

### 4. Provisional answers to design-suite open questions

Each row is **v1 provisional** — an implementation choice, not a design
decision; the design suite's Open Questions stand unchanged.

| Open question (suite)                 | v1 answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Definition placement (ADR-003)        | Definitions may appear in any `.spec` file and are suite-global. Loading is two-pass: parse every file, register all definitions (lexicographic file order, duplicates are load errors), then execute tests — resolution is order-independent by construction.                                                                                                                                                                                                                                   |
| `expect` semantics (ADR-002)          | Two forms. Value form `expect A B`: deep structural equality; `expect A` alone: truthiness. Observable form `expect <tool> args…`: the tool is an observable (e.g. `fs.file`, `fs.directory`) returning a checked assertion (`exists`, `contains <expr>`). First atom resolving to both a binding and a tool is an error (never guess).                                                                                                                                                          |
| `eventually` semantics (ADR-002)      | Retries its whole block until it passes or the deadline expires; default deadline 5s, poll interval 100ms, `within <duration>` overrides the deadline. Only assertions and observable calls are allowed inside (mutating tools are a runtime error).                                                                                                                                                                                                                                             |
| Process permission identity (ADR-007) | `--allow-run=name[,name…]` matches the argv[0] basename; bare `--allow-run` allows any executable. Hashes/paths deferred.                                                                                                                                                                                                                                                                                                                                                                        |
| Network permission shape (ADR-007)    | `--allow-net=host[:port][,…]` exact host match, optional port; bare `--allow-net` unrestricted. URL patterns deferred.                                                                                                                                                                                                                                                                                                                                                                           |
| Env scoping (ADR-007)                 | `--allow-env=VAR[,…]` exact names; bare `--allow-env` all. Child processes spawned by `cli.run` receive _only_ granted variables (plus PATH/HOME/TMPDIR needed to execute at all) — subprocess non-inheritance is v1's least-privilege answer.                                                                                                                                                                                                                                                   |
| Host filesystem (ADR-007)             | `--allow-host-fs=dir[,…]` path-prefix grants; without it, absolute paths and any path resolving outside the workspace are denied.                                                                                                                                                                                                                                                                                                                                                                |
| Workspace escape (ADR-006)            | Paths are resolved against the workspace root and rejected if the resolved path leaves it (covers `..` traversal); symlink targets are re-resolved before access.                                                                                                                                                                                                                                                                                                                                |
| Plugin protocol/transport (ADR-004)   | One `Plugin` interface: `describe()` returns typed tool descriptors (name, params, `requires` permission metadata); `call(tool, args, ctx)` executes. Built-ins (`fs`, `cli`, `http`) implement it in-process; the same interface has an NDJSON-over-stdio transport (`spec` line-protocol, JSON-RPC-shaped) proving language neutrality with a demo external plugin. The runtime checks permissions before every call — plugin self-restraint is never load-bearing (the suite's Decided rule). |
| Environments (ADR-008)                | Not implemented. `http` accepts absolute URLs; a relative URL fails with a diagnostic explaining that binding a base URL is the environments mechanism, which v1 does not ship. This keeps v1 honest instead of freezing a config format the design left open.                                                                                                                                                                                                                                   |
| Workspace size limits, parallelism    | No limits; tests execute sequentially in v1. Parallelism is a runner concern that isolation already permits later.                                                                                                                                                                                                                                                                                                                                                                               |

### 5. Architecture

```
src/
  cli.ts            CLI entry (arg parsing, exit codes)
  runner.ts         orchestration: load suite → per test: workspace + executor → report
  source.ts         source text, spans, positions
  tokens.ts lexer.ts ast.ts parser.ts
  loader.ts         .spec discovery + two-pass definition registry
  registry.ts       name resolution: namespaces, `use`, commands, fixtures, ambiguity errors
  values.ts         runtime value model (string/number/bool/duration/object/list/opaque)
  workspace.ts      temp-dir workspace: create, resolve-safely, cleanup
  permissions.ts    grant parsing (--allow-*) and centralized checks
  executor.ts       statement/block/test execution, scopes, let/return
  expectation.ts    expect + eventually
  diagnostics.ts    structured diagnostics (failing statement, expected/observed, denial + remedy)
  reporter.ts       human output to a sink (never console.log)
  plugin.ts         Plugin/ToolDescriptor/ToolContext contracts
  transport-stdio.ts NDJSON child-process plugin transport
  plugins/fs.ts plugins/cli.ts plugins/http.ts
spec/               the dogfood suite (see §6)
GRAMMAR.md README.md
```

One abstraction rule governs the design: the typed-tool `Plugin` interface is
the only extension seam. Built-in capabilities, external stdio plugins, and
test fakes all implement it; the executor, permission engine, and diagnostics
never know which kind they are talking to.

### 6. Dogfooding: the tool specifies itself

Once the CLI runs, `packages/spec/spec/*.spec` becomes the tool's own
black-box behavioral suite — written in the language, executed by the runtime,
exercising the CLI as a child process:

- `run.spec` — running a passing suite exits 0 and reports counts; a failing
  expectation exits 1 and names the failing statement.
- `language.spec` — comments are inert; given/when/then order is enforced;
  duplicate definitions are load errors; ambiguous unqualified names error.
- `workspace.spec` — each test gets a fresh workspace; files do not leak
  between tests; `..` traversal is denied.
- `permissions.spec` — `cli.run` without `--allow-run` fails with the
  denial diagnostic naming the exact flag; scoped grants admit exactly their
  scope.

Each dogfood test writes a miniature project (a `spec/` directory plus spec
files) into its own isolated workspace with `fs`, invokes the `spec` binary on
it with `cli.run`, and asserts on stdout/exit codes — precisely the
fs → cli → assertions flow ADR-006 describes. The dogfood suite runs under
`--allow-run=spec,bun` and nothing else, which doubles as a live demonstration
of least privilege. A thin `bun:test` wrapper executes the dogfood suite in CI
so `bun test --isolate` covers it.

### 7. Testing strategy

Unit tests colocated per module (lexer, parser, loader, permissions,
workspace, executor, plugins — `http` mocked with MSW per repo rules).
Integration tests drive `runner.ts` against fixture suites on disk. The
dogfood suite is the acceptance layer. Everything runs from the repo root.

## Consequences

- Every example in the design suite that uses `fs`, `cli`, or `http` is
  executable as written; browser examples remain prose until a browser plugin
  exists.
- The design suite's Open Questions gain real implementation feedback: v1's
  provisional answers are the experiments, and promoting or replacing them is
  a future design-suite revision, not a silent drift.
- Adding the browser family later is additive: one plugin, zero core changes
  — the test of §5's one-seam rule.

## Open Questions

- When the browser plugin lands, which automation backend does the _first_
  implementation wrap, and does it live in this package or its own?
- Should the dogfood suite eventually replace the integration-test layer
  entirely, leaving only unit tests in `bun:test`?
- When do ADR-001…008 flip from Proposed to Accepted — at v1 landing, or
  after the dogfood suite has run long enough to trust?
