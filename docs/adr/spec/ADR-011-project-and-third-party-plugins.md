# ADR-011: Project and Third-Party Plugin Loading

## Status

**Proposed** - 2026-08-09

This ADR adds per-project and third-party plugin loading to the v1 runtime.
Like [ADR-009](./ADR-009-v1-typescript-implementation.md),
[ADR-010](./ADR-010-browser-capability-on-agent-browser.md), and
[ADR-012](./ADR-012-database-capability.md), it is an implementation ADR: not
standalone, free to reference this monorepo's packages and conventions, and
bound by the design suite
([ADR-001](./ADR-001-executable-specification-language.md) through
[ADR-008](./ADR-008-environments-and-compatibility.md)) rather than amending it.
Its behavioral authorities are
[ADR-004](./ADR-004-runtime-and-plugin-protocol.md) (the plugin protocol) and
[ADR-007](./ADR-007-deny-by-default-permissions.md) (deny-by-default
permissions). It gives ADR-004's **Open Question "Plugin installation and
discovery"** a v1-provisional answer for the loading-and-launch half of that
question; the distribution-and-versioning half stays open. Nothing here promotes
a design-suite **Open** item into a settled decision — every choice forced by
shipping is recorded as **v1 provisional**: binding on this implementation,
invisible to the design record, cheap to revisit.

## Context

The runtime shipped its capabilities — `fs`, `cli`, `http` (ADR-009), `browser`
(ADR-010), `db` (ADR-012) — as built-in plugins registered in the runner's own
code. The extension seam they all sit behind is the same one ADR-009 gave
external processes: `connectStdioPlugin` spawns a command and speaks the
NDJSON-over-stdio line protocol, and `servePlugin` lets any Bun script serve
that protocol. So the runtime can already _talk to_ an arbitrary external
plugin. What it could not do is _come to be talking to one_: there was no way
for a project to say "this suite uses a plugin called `demo`, launched this
way," and no decision about whether typing `spec run` should launch it.

That is exactly ADR-004 §5's boundary. Discovery — what tools a plugin offers —
is answered by the handshake once a connection exists. But ADR-004's Open
Question is the step before: "how does a project declare which plugins it needs,
how are they obtained and updated, and how does the runtime locate them at
startup?" ADR-004 sketched an illustrative happy path — "a project manifest
lists the plugins the suite uses; at startup the runtime launches each one" —
and explicitly left it undecided.

Two forces shape the answer. The first is portability, the same constraint that
shaped ADR-008: a `.spec` file must name capabilities, never locations, so the
same spec runs anywhere. A spec that hard-coded `bun ./plugins/demo.ts` would
break the moment the plugin moved or the suite ran on another machine. The
second is trust. A manifest is a file in a repository. Auto-launching whatever
it names would mean that cloning a repo and running its specs executes
arbitrary project-declared commands — precisely the "trusted vs.
spec-requested execution" hazard ADR-007 §4 draws a line around. Plugin launch
has to sit on the guarded side of that line.

## Decision

Add CLI-internal plugin loading in `packages/spec/src/project-plugins.ts`,
wired through `src/cli.ts`. A project declares its plugins in a manifest; the
CLI launches a declared plugin only when the caller grants `--allow-plugins`,
connects the authorized ones over the existing stdio transport, and passes them
to `runSuite` through the `RunOptions.plugins` seam that already existed. No
change to the runner, the executor, the permission engine, or the language.

### 1. A per-project manifest maps a namespace to a launch command

The suite directory — the one `spec run` is pointed at — may contain a manifest
named `spec.plugins.jsonc` (tried first) or `spec.plugins.json`:

```jsonc
{
	"plugins": {
		"greet": { "command": ["bun", "./greeter.ts"] },
	},
}
```

It maps a **namespace** to the **command** that launches its plugin. This is the
one place a path appears in a suite: `.spec` files name `greet.hello`, never
`./greeter.ts`. That split is the portability decision — the manifest is
environment configuration, the analogue for plugins of the connection string
ADR-012 keeps out of specs and the environments ADR-008 defers. The same specs
run against a different machine's manifest with nothing changed but the file
that says where each plugin lives.

Three rules make the manifest predictable:

- **Relative command paths are manifest-relative.** A command argument starting
  with `.` is resolved absolute against the manifest's directory, so the command
  launches identically regardless of the caller's working directory. Every other
  argument — an executable found on `PATH`, an absolute path, a bare flag — is
  passed through verbatim. This is what lets a third-party plugin be named by its
  installed binary (`"command": ["some-plugin"]`) and a local one by a path
  (`"command": ["bun", "./plugins/local.ts"]`) in the same file.
- **Built-in namespaces are reserved.** A manifest may not declare `fs`, `cli`,
  `http`, `browser`, or `db`; doing so would silently shadow a built-in in the
  registry, so it is a load error instead.
- **A missing manifest is not an error.** A suite that uses only built-ins needs
  no manifest; the loader returns an empty plugin set.

The manifest is JSONC — comments and trailing commas are tolerated — so the file
can document itself, since it is the one place an operator configures where
plugins come from. The loader is kept CLI-internal (not exported from the
package index): a programmatic embedder using `runSuite` supplies plugins
directly and has no need of it, and a public manifest API can follow once its
shape has settled.

### 2. Launch is deny-by-default, gated by `--allow-plugins`

Declaring a plugin is not permission to run it. Launching a manifest plugin
executes the command the project declares, so it is refused unless the caller
opts in — the exact stance ADR-007 takes toward `run`, `net`, `env`, and
`host-fs`, extended to the act of starting a plugin process:

| Invocation                         | Effect                                 |
| ---------------------------------- | -------------------------------------- |
| `spec run dir`                     | No manifest plugin launches            |
| `spec run dir --allow-plugins`     | Every declared plugin may launch       |
| `spec run dir --allow-plugins=a,b` | Only namespaces `a` and `b` may launch |

`--allow-plugins` is deliberately **not** a fifth member of the permission
engine's grant families. Those four gate what a _running_ capability may reach;
this gates whether a _process starts at all_. It is parsed CLI-side and peeled
off before the permission parser runs — the permission engine is untouched, and
a launched plugin's tools are still gated by their own `requires` grants exactly
as a built-in's are. So a database plugin loaded from a manifest still needs
`--allow-env=DATABASE_URL` to read its connection string; `--allow-plugins`
only decided that its process could start.

**The refusal fires on use, not on declaration.** A declared plugin the suite
never imports stays dormant with no consequence — deny-by-default means "do not
launch," not "fail because it exists." Only when a spec actually imports a
refused namespace (`use greet`) is the run refused, before any process starts,
with a permission-style diagnostic that names the missing grant:

```
✗ permission-denied: Plugin launch denied: the suite imports the plugin
  namespace greet, declared in the plugin manifest but not authorized to launch…
  remedy: spec run --allow-plugins=greet
```

Detecting the reference at `use` is what lets the diagnostic name
`--allow-plugins` instead of degrading to a generic "unknown namespace." The
runtime cannot know a plugin's tools without launching it — which is the very
thing being withheld — so it cannot resolve `greet.hello` to a placeholder that
explains itself. `use greet` is the portable, declared dependency edge, so the
CLI scans the loaded suite's `use` imports against the refused namespaces and
reports the shortfall as a pre-run failure (exit 2), the same class as a
missing directory or a parse error: the suite is misconfigured for this
invocation and no test can meaningfully run. A qualified call to a refused
namespace _without_ a `use` (`greet.hello` with no import) still fails — it is
an unresolved name — but with the generic diagnostic; closing that gap is an
open question below.

### 3. Wiring: connect the authorized plugins, dispose them after the run

`src/cli.ts` performs the loading between parsing flags and running the suite:

1. `parsePluginGrant` peels `--allow-plugins` out of the argument vector,
   leaving the rest for the unchanged permission parser.
2. `loadPluginManifest` reads the manifest from the suite directory.
3. `planPluginLaunch` splits the declarations into those the grant authorizes
   and the namespaces it refuses. If any refused namespace is imported
   (`deniedReferences` over the loaded suite), the run is refused (§2).
4. `connectManifestPlugins` connects each authorized declaration over
   `connectStdioPlugin`, in declaration order. A connection that fails the
   handshake disposes the ones already connected and fails the launch, so a
   partial launch never leaks a child process.
5. The connected plugins are passed to `runSuite({ plugins })` — the seam
   ADR-009 already built for extra plugins — so from the executor's point of
   view a manifest plugin is indistinguishable from a built-in.

Termination reuses the `dispose()` hook ADR-010 added and the runner already
calls once per plugin after the whole suite. `connectStdioPlugin`'s connected
plugin now implements `dispose()` by killing its child and failing anything
in flight, so a launched plugin never outlives the suite that launched it. One
edge the runner does not cover — a suite that fails to _load_ returns before the
runner's teardown — is handled in the CLI, which disposes the plugins it
launched on that path too.

### 4. Third-party plugins are the same mechanism

There is no separate third-party path. A plugin someone else publishes is
installed (`bun add`, or vendored into the repo) and named in the manifest by
the command that launches it — an installed binary on `PATH` or a script path.
Because the manifest names a launch command rather than an import, the plugin
may be written in any language that can speak the line protocol, and the same
`--allow-plugins` trust model governs it. The authoring guide
([`packages/spec/docs/writing-plugins.md`](../../../packages/spec/docs/writing-plugins.md))
covers all three shapes — in-process for embedders, external over stdio, and
loaded via the manifest — end to end, with a runnable showcase under
`packages/spec/examples/plugin-loading/`.

## Consequences

### Positive

- ADR-009's additivity claim holds once more: project plugin loading landed as
  one new CLI-internal module plus CLI wiring and a one-line `dispose` on the
  transport, with no change to the runner, executor, permission engine, lexer,
  or parser.
- The manifest keeps specs portable — a `.spec` names `greet.hello`, and where
  `greet` comes from is configuration, so the same suite runs against a
  developer's checkout, CI, and a teammate's machine unchanged.
- Plugin launch inherits the runtime's honesty: cloning a repository and running
  its specs cannot execute project-declared commands until the operator says so,
  and the refusal points at the exact flag that would allow it.
- Third-party and first-party plugins load through one mechanism, so the
  ecosystem stays language-neutral and the runtime stays ignorant of any
  specific plugin — the neutrality ADR-004 §5 argued for.

### Negative

- The deny-by-default refusal is detected through `use` imports, so a spec that
  calls a refused namespace with a fully qualified name and no `use` gets the
  generic unknown-name error rather than the `--allow-plugins` remedy. The
  common, documented style (`use greet`) is covered; the gap is recorded below.
- A refused import fails the whole run rather than only the tests that touch the
  plugin. Plugin launch is a per-run configuration decision, not a per-test one,
  so this is deliberate, but it means one un-granted plugin blocks an otherwise
  runnable suite.

### Neutral

- The manifest lives in the suite directory (the argument to `spec run`), not a
  separately discovered project root. For a self-contained suite the two
  coincide; whether a project-root search is worth the ambiguity is left open.
- Nothing about obtaining or updating a plugin is decided here: the manifest
  names a command and assumes it already exists on the machine. Installation and
  distribution remain ADR-004's open question.

## Open Questions

These are v1-provisional pressure points, not reopenings of the design suite.

- **Installation and distribution.** This ADR answers "how does a project
  declare and launch a plugin"; it does not answer "how does the plugin come to
  be on the machine." The manifest assumes the command already resolves. A
  lockfile, a registry, version pinning, and update semantics are the
  still-undesigned half of ADR-004's open question.
- **Scoped permissions over the wire.** An external plugin receives the
  workspace root and the coarse `requires` gate runs host-side, but the caller's
  _scoped_ grants (which host, which variable) are not transmitted across the
  transport — the plugin does its own I/O. Enforcing fine-grained permissions on
  a non-local plugin process is the transport-and-enforcement open question
  ADR-004 and ADR-007 both flag; genuinely privileged, precisely scoped
  capabilities stay built-in until it closes.
- **Qualified references without `use`.** Refusal is detected at `use`. A
  qualified call to a refused namespace with no import fails as an unresolved
  name rather than a launch denial. Teaching resolution to recognize a declared
  namespace and surface the `--allow-plugins` remedy would close the gap, at the
  cost of threading manifest knowledge into the registry.
- **Manifest location and multiple manifests.** A single manifest in the suite
  directory is v1. A project root search, a user-level manifest, or merging
  several manifests are plausible once a real multi-suite project needs them.
- **Plugin health and versioning.** The handshake confirms a plugin answers
  `describe`, but there is no protocol-version negotiation, health check, or
  restart-on-crash — the capability/version-negotiation open question of ADR-004
  applies unchanged to manifest-loaded plugins.
