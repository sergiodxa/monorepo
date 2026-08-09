# ADR-013: Declaring Permissions in spec/config.jsonc

## Status

**Proposed** - 2026-08-09

This ADR adds a `permissions` key to the suite's project configuration file and
an opt-in flag that applies it. Like
[ADR-009](./ADR-009-v1-typescript-implementation.md),
[ADR-011](./ADR-011-project-and-third-party-plugins.md), and
[ADR-012](./ADR-012-database-capability.md), it is an implementation ADR: not
standalone, free to reference this monorepo's packages and conventions, and
bound by the design suite
([ADR-001](./ADR-001-executable-specification-language.md) through
[ADR-008](./ADR-008-environments-and-compatibility.md)) rather than amending it.
Its behavioral authority is
[ADR-007](./ADR-007-deny-by-default-permissions.md) (deny-by-default
permissions). It gives ADR-007's **Open Question** — "Can a suite declare the
permissions it requires while approval still rests with the caller?" — a
v1-provisional answer, and it keeps
[ADR-001](./ADR-001-executable-specification-language.md)'s **principle 24**
(AI-generated specifications must not be able to grant themselves additional
privileges) intact. Nothing here promotes a design-suite **Open** item into a
settled decision; every choice forced by shipping is recorded as **v1
provisional**: binding on this implementation, invisible to the design record,
cheap to revisit.

## Context

ADR-007 made every capability deny-by-default: a `spec run` grants nothing, and
the caller adds `--allow-run`, `--allow-net`, `--allow-env`, or `--allow-host-fs`
at the invocation boundary. That is the right default, but it leaves the
operator to reconstruct, by trial and denial, exactly which flags a given suite
needs. ADR-007 flagged the remedy as an open question and drew its one hard
constraint: a suite may _declare_ what it requires only if declaring never
shades into self-granting. Principle 24 is the same rule stated as an
invariant — a specification (including one an agent authored) must not be able
to widen what it may touch.

[ADR-011](./ADR-011-project-and-third-party-plugins.md) then introduced a
per-project configuration file, `spec/config.jsonc`, whose `plugins` key
declares the plugins a suite launches. That file is the natural home for a
declaration of the suite's permission requirements: it already sits in the
suite directory, is read CLI-side before the run, and is environment
configuration rather than specification. What it lacked was a permission
vocabulary and, crucially, a decision about whether declaring a permission
there should have any effect on its own.

## Decision

Add a top-level `permissions` key to `spec/config.jsonc`, applied only when the
caller passes a single bare flag, `--allow-config`. The file's loader
(`src/project-config.ts`) parses and validates the key; `src/cli.ts` decides
whether and how to apply it. The permission engine (`src/permissions.ts`), the
runner, the executor, and the language are unchanged except for pure,
additive helpers.

### 1. The `permissions.allow` grammar

`permissions.allow` is a list. Each entry is either a bare family string or a
`[family, ...scopes]` tuple, mirroring the CLI flag forms one-for-one:

```jsonc
// spec/config.jsonc
{
	"permissions": {
		"allow": ["run", ["env", "DATABASE_URL"], ["net", "localhost:3000", "api.example.com"]],
	},
}
```

- A bare string is a **whole-family** grant, equal to a bare `--allow-<family>`:
  `"run"` ≡ `--allow-run`, and likewise `"net"`, `"env"`, `"host-fs"`,
  `"plugins"`.
- A tuple is a **scoped** grant, equal to `--allow-<family>=scope1,scope2`:
  `["env","DATABASE_URL"]` ≡ `--allow-env=DATABASE_URL`;
  `["run","node","echo"]` ≡ `--allow-run=node,echo`. The first element is the
  family; the rest are scopes.
- An unknown family or a malformed entry (an empty tuple, a non-string scope, a
  non-array `allow`) is a `usage-error` load diagnostic that names the offending
  entry. A broken declaration is **never silently ignored**, and this validation
  runs whenever the file is read — a bad config is a bad config regardless of
  whether `--allow-config` is in play.

The four capability families fold into the same `Grants` set the CLI parser
produces, reusing the identical scope-widening logic, so a config tuple and a
repeated `--allow-*` flag merge indistinguishably. The fifth family,
`"plugins"`, is not a capability; it folds into ADR-011's plugin _launch_ grant
exactly as `--allow-plugins` does.

### 2. Declare + opt-in: the declaration is inert until the caller approves

The declaration has **no effect** on its own. `spec run` with no opt-in flag
applies nothing from `permissions.allow`; a suite that needs a permission still
fails closed with the ordinary permission-denied diagnostic. The caller opts in
with one explicit flag:

| Invocation                                  | Effect                                                  |
| ------------------------------------------- | ------------------------------------------------------- |
| `spec run dir`                              | `permissions.allow` is inert; deny-by-default as before |
| `spec run dir --allow-config`               | The declared grants apply, unioned with any CLI flags   |
| `spec run dir --allow-config --allow-net=x` | Config grants **plus** the CLI flag both apply          |

When `--allow-config` is passed, the effective grants are the config's declared
set **unioned** with any explicit `--allow-*` flags. CLI flags always still work
and only ever _add_ to the config set, never subtract — the same widening
ADR-007's parser already uses for repeated flags. `--allow-config` takes no
value; a `--allow-config=…` form is a usage error.

This is the precise shape ADR-007's open question asked for: a suite may declare
its requirements while the caller still explicitly approves them. Because the
effect is opt-in, a cloned or untrusted repository cannot self-grant — nothing
in the file takes effect until an operator who has read it adds the flag. That
keeps principle 24 intact: the config file is authored inside the untrusted
loop (an agent may write it), but the grant vocabulary still only bites at the
invocation boundary the agent does not control. A generated `spec/config.jsonc`
declaring `["run", ["net", "evil.example.com"]]` is inert; it changes nothing
until a person types `--allow-config`.

### 3. A one-flag DX hint, without weakening the default remedy

Deny-by-default's teaching remedy — every denial names the exact
`--allow-<family>=…` flag that would grant it — is preserved verbatim. When, and
only when, the caller has _not_ opted in and the project's `spec/config.jsonc`
**would** have granted the denied resource, the denial gains one extra line
pointing at the one-flag path:

```
This project's spec/config.jsonc declares this permission; re-run with
--allow-config to apply the project's declared permissions.
```

The hint is computed CLI-side, the only layer that holds both the run's denials
and the loaded config, by asking whether the config's declared grants would
admit the denial's resource (reusing the same checks enforcement runs). When the
config would _not_ grant it, no hint appears and the ordinary
`--allow-<family>=…` remedy stands alone. The hint is carried on the error as an
optional field the reporter renders after the remedy; it never replaces it.

### 4. Wiring

`src/project-config.ts` validates `permissions.allow` into typed entries beside
the existing `plugins` parsing, exposing `pluginGrantFromConfig` /
`mergePluginGrants` for the launch grant. `src/permissions.ts` gains three pure,
additive helpers: `grantsFromConfig` (entries → `Grants`), `mergeGrants` (union
two grant sets), and `grantsAdmit` (would a grant set admit a resource — for the
hint). `src/cli.ts` peels `--allow-config` first, loads the config, and builds
the effective grants (`allowConfig ? mergeGrants(cli, config) : cli`) and the
effective plugin launch grant the same way, then annotates any denial the config
would have covered. The loader stays CLI-internal; a programmatic embedder using
`runSuite` supplies grants directly and has no need of it.

## Consequences

- An operator can grant a suite's footprint with one reviewed flag instead of
  reconstructing the flag line by trial and denial, while the reviewed decision
  still happens at the invocation boundary, once, by a person.
- The config file becomes a readable, machine-checkable record of what a suite
  needs — useful to a human deciding whether `--allow-config` is safe here, and
  to tooling that wants to diff a suite's declared footprint over time.
- Deny-by-default is unchanged for every existing invocation: no config, or a
  config without `--allow-config`, behaves exactly as before this ADR.
- The union rule means `--allow-config` can never _reduce_ what a CLI flag
  granted; the two compose, so a caller can opt into the declaration and still
  add a one-off grant the file does not mention.
- A malformed declaration fails the run loudly (exit 2) rather than degrading to
  a silent partial grant, so a typo in `permissions.allow` cannot quietly leave
  a suite under-permissioned.

## Open Questions

These are v1-provisional pressure points, not reopenings of the design suite.

- **Per-entry justification and provenance.** The list records _what_ a suite
  requires, not _why_ or _who added it_. A comment convention exists (JSONC),
  but a structured "reason" per entry — surfaced in the approval moment — is a
  plausible later refinement.
- **Partial opt-in.** `--allow-config` is all-or-nothing over the declared set.
  Approving a subset (`--allow-config=run,env`) is conceivable once a real suite
  wants it, but it adds a second scoping vocabulary and is deferred until then.
- **Scoped permissions over the wire.** The `permissions` key can declare grants
  for capabilities an external plugin serves, but ADR-011's open question stands:
  the caller's _scoped_ grants are not transmitted across the stdio transport, so
  a non-local plugin still does its own I/O under only the coarse `requires`
  gate. Declaring a scope here does not close that gap.
