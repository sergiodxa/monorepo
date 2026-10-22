# ADR-169: Kit Automates Static Agent Work When It Fits in Code

## Status

**Proposed** - 2026-10-22

## Background

Agents working in an sdxc app spend tokens on steps that are the same every time: create a
file in the right folder, declare it in a map, mount it on a router, append a secret to
`.env.example`, register a model that already exists, run `typegen` after a binding change.
[`@sdxc/kit`](https://www.npmjs.com/package/@sdxc/kit) already removes a large share of that
through `make`, `scaffold`, `destroy`, `routes`, `doctor`, `upgrade` and `deploy`. What is left
is still mostly mechanical — and agents re-derive it from `AGENTS.md` on every turn.

The limit is not imagination: it is whether the step has a deterministic shape. A rule that
needs a product judgment (where a Durable Object's logic belongs, what a release note says to a
consumer, whether a migration is safe to rewrite) stays with a person or an agent. A rule whose
inputs and outputs are fixed belongs in the kit.

## Context

- Generated projects already tell agents to prefer the CLI
  ([ADR-162](./ADR-162-agents-md-in-generated-projects.md)): `sdxc make` for files,
  `sdxc doctor --json` for drift, `sdxc routes --json` for wiring. Agents still fall back to
  hand-editing when the CLI has no verb for the step.
- `sdxc doctor` (ADR-160) is deliberately read-only. Each finding already names a `fix`, often
  another `sdxc` command (`upgrade`, `ui update`, `run typegen`) or a one-line file edit
  (`printf … >> .env.example`). Agents copy those strings and apply them by hand.
- Remix's own CLI ships `remix doctor --fix` for low-risk repairs. That pattern fits here as
  long as diagnosis stays separate from mutation: CI and agents must keep a safe "report only"
  path.
- Generators already close the loop for _new_ work: `make` declares and maps controllers, jobs,
  emails, MCP tools and commands; `make middleware --mount` edits a chain; `make model` writes
  the migration and factory. Gaps show up when something was written without `make`, or when
  the change is a binding, a Durable Object class, or another kind the stubs never covered.
- `@sdxc/codemod` (ADR-137) already powers declaration and mapping edits. Anything that is "add
  this import and this call in this file" can reuse that path instead of asking an agent to
  invent the edit.
- The monorepo's own `create-app` / `create-package` skills describe another layer of static
  work (workspace `package.json`, Vitest project registration, `fmt.overrides`). That work is
  _this_ repository's tooling, not the published kit's product surface for consumer apps. This
  ADR does not fold monorepo scaffolding into `@sdxc/kit`; it may still motivate separate
  scripts under `scripts/` later.

## Decision

### Criterion

Automate a step in `@sdxc/kit` when **all** of the following hold:

1. **Deterministic.** Given the same project state and the same flags, two runs write the same
   files (or the same report). No product judgment, no "pick the nicer name", no release-note
   prose.
2. **Locally checkable.** A test can assert the before/after without a human reading the diff
   for intent.
3. **Named by a verb the agent already knows.** Prefer extending `make`, `destroy`, `doctor`,
   `upgrade` or a new `fix` over inventing a one-off script an `AGENTS.md` has to teach.
4. **Safer than the agent.** The command refuses or `--dry-run`s when the edit would be
   ambiguous (two possible homes, a file that was hand-edited, a migration that already ran).

Everything else stays in docs, skills and agent judgment: architecture placement, consumer-facing
commit bodies, migration semantics on live data, UI copy, policy grants beyond the scaffold's
defaults.

### Prefer generate over repair; prefer repair over narration

| Situation                                     | Mechanism                                                         |
| --------------------------------------------- | ----------------------------------------------------------------- |
| Creating a new kind of file or wiring         | `sdxc make` / `sdxc scaffold` (extend kinds and stubs)            |
| Removing what `make` wrote                    | `sdxc destroy`                                                    |
| Project drifted from a rule the kit can prove | `sdxc doctor` reports; `sdxc fix` applies only named safe repairs |
| Release moved and the code must follow        | `sdxc upgrade` + its prompt (agent applies _code_ changes)        |

`doctor` stays read-only (ADR-160). A separate `sdxc fix [check…]` (or `sdxc doctor --fix`
that only enables that path) applies repairs the report already knows how to express. A check
without a coded repair keeps printing prose; the agent still does that one. Never invent a
repair that `doctor` would not have named.

### First backlog (ordered by agent token cost vs. implementation risk)

1. **`sdxc fix` for command-shaped repairs.** Re-run `typegen`, `ui update`, package install and
   `upgrade` when those are the check's `fix`. Zero new mutation logic: the kit already owns
   those commands. Agents stop re-typing them.
2. **`sdxc fix env`.** Append missing `bindings.secret()` keys to `.env.example` exactly as the
   `env` check's fix string describes. Refuse keys that need a value the kit cannot invent.
3. **`sdxc fix models` / `sdxc fix emails`.** Register an unmapped `createModel` module in
   `app/models/index.ts`, or map an unmapped email in `app/initializers/mail.ts`, through the
   same codemod `make` uses. Only when the file path is unambiguous.
4. **`sdxc make secret <NAME>` and `sdxc make binding <kind> <NAME>`.** Edit
   `cloudflare.config.ts`, append `.env.example` when the binding is a secret, and print
   `sdxc run typegen` (or run it). Agents today hand-edit three places.
5. **`sdxc make durable-object <Name>`.** Write the class under `app/models/` or
   `app/services/` (`--role`), re-export it from `bootstrap/worker.ts`, and declare the binding
   in `cloudflare.config.ts`. The class body stays a stub; placement is a flag, not a guess.
6. **Stop there until measured.** Do not auto-rewrite JSDoc prose, move files between layout
   folders, or rewrite migration SQL. Those fail the criterion: the "right" edit needs reading
   intent.

Each item lands with tests, `--dry-run`, a line in the managed `AGENTS.md` section, and a guide
update so agents learn the verb from the release that ships it.

### What agents still own

- Choosing _whether_ to add a feature, which resource to scaffold, and which fields matter.
- Filling stubs: handler bodies, policy nuance past `everyone`/`member`, email copy, UI.
- Applying upgrade prompts that change call sites in app code.
- Writing Conventional Commit subjects and bodies for consumers (ADR-007 / ADR-140): the shape
  is fixed, the content is not.
- Monorepo-only chores (new workspace package wiring, Vitest project rows) until a separate
  decision puts them in `scripts/`.

## Consequences

### Positive

- **Fewer tokens on boilerplate.** An agent runs one command instead of reading a skill,
  inventing paths and editing four files.
- **Fewer layout and wiring bugs.** The same mistakes `doctor` already catches get closed by
  code that cannot drift from the stubs.
- **Clear boundary.** "Can we express this in a test?" is the gate for new kit work, so the CLI
  does not grow into an unsupervised refactor bot.

### Negative

- **`fix` is a new mutation surface.** It needs the same confirmation/`--yes`/`--dry-run`
  discipline as `destroy` and `deploy`, and CI must keep calling `doctor` without `--fix`.
- **Ambiguous projects stay manual.** A hand-rolled models index or a non-standard mail
  initializer will not get a silent rewrite; `fix` must refuse rather than guess.
- **Backlog items compete with package work.** Shipping them one at a time keeps the kit
  honest; bundling them risks half-working generators agents trust too much.

### Neutral

- Remix's `doctor --fix` is a precedent, not a dependency. The kit keeps its own check list
  and its own repair set.
- Monorepo agent automation may mirror this criterion in `scripts/` without changing `@sdxc/kit`.

## Alternatives Considered

### 1. Teach agents better prompts only

**Rejected because**: `AGENTS.md` already teaches `make` and `doctor`, and agents still spend
turns on the mechanical steps the CLI could own. Documentation without a verb regresses on every
model change.

### 2. Put `--fix` on `doctor` and allow any check to write

**Rejected as the default** because ADR-160's read-only contract is what makes `doctor` safe in
CI and in a loop. A dedicated `fix` command (or an explicit `--fix` that only enables coded
repairs) keeps the report path unchanged. If the CLI spells it `doctor --fix`, the
implementation still routes through the same allowlisted repairs.

### 3. Autofix JSDoc, layout moves and migration SQL

**Rejected because**: those edits need intent. A wrong JSDoc rewrite or a silent `ALTER`
"repair" costs more than the tokens it saves.

### 4. Fold monorepo `create-package` into the published kit

**Rejected for this ADR** because consumer apps do not create `@sdxc/*` workspaces. That
scaffolding belongs in this repository's scripts if it is automated at all.

## References

- [ADR-137: `@sdxc/codemod`](./ADR-137-codemod-package.md)
- [ADR-143: `sdxc make` Generators](./ADR-143-sdxc-make-generators.md)
- [ADR-160: `sdxc doctor`](./ADR-160-sdxc-doctor.md)
- [ADR-162: `AGENTS.md` in Generated Projects](./ADR-162-agents-md-in-generated-projects.md)
- [ADR-163: `sdxc scaffold`](./ADR-163-sdxc-scaffold.md)
- Remix CLI `doctor --fix` (vendor docs under `docs/vendor/@remix-run/cli`)

## Current Progress

- [x] Criterion and backlog recorded as Proposed
- [ ] Accept or revise the criterion with Sergio
- [ ] Implement `sdxc fix` for command-shaped repairs (item 1)
- [ ] Implement `sdxc fix env` (item 2)
- [ ] Implement model/email registration repairs (item 3)
- [ ] Implement `make secret` / `make binding` (item 4)
- [ ] Implement `make durable-object` (item 5)
- [ ] Measure agent turns before adding further kinds

## Notes

The test for a new kit feature aimed at agents: after it ships, the managed `AGENTS.md` section
can drop the hand-edit recipe and name the command instead. If the section still needs a
paragraph of "then open these three files", the feature is not done.
