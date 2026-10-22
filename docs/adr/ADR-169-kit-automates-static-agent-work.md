# ADR-169: Encode Static Agent Work in Code

## Status

**Proposed** - 2026-10-22

## Background

Agents spend tokens on steps that are the same every time: create a file in the right folder,
declare it in a map, append a secret to `.env.example`, run build → migrate → deploy in order,
publish only the packages that changed, check every app with `doctor`. Those steps are already
being moved into code in three places:

- **`@sdxc/kit`** — `make`, `scaffold`, `destroy`, `routes`, `doctor`, `upgrade`, `deploy` for
  any project on the `@sdxc/*` packages.
- **Repo scripts** — `scripts/release/`, `scripts/doctor-apps.ts`, `scripts/upgrade-dependencies.ts`
  and the rest under `scripts/`, invoked from root `package.json` and CI.
- **GitHub Actions** — `deploy-apps.yml`, `deploy-sdxc.yml`, `release.yml`, and the doctor /
  commit-check jobs in `ci.yml`, so a person or agent triggers a workflow instead of replaying
  the sequence by hand.

The limit is not imagination: it is whether the step has a deterministic shape. A rule that
needs a product judgment stays with a person or an agent. A rule whose inputs and outputs are
fixed belongs in one of those three surfaces — not in another paragraph of `AGENTS.md`.

## Context

- Generated projects already tell agents to prefer the CLI
  ([ADR-162](./ADR-162-agents-md-in-generated-projects.md)): `sdxc make` for files,
  `sdxc doctor --json` for drift, `sdxc routes --json` for wiring. Agents still fall back to
  hand-editing when the CLI has no verb for the step.
- `sdxc deploy` (ADR-161) owns build → migrate → deploy order so nobody reconstructs it from
  memory. `.github/workflows/deploy-apps.yml` is that command's production path: pick an app,
  optionally dry-run, and the workflow runs the kit binary with the right flags (including
  `--skip migrate` when the app has no D1). An agent that deploys by shelling `cf deploy` by
  hand burns tokens and can invert the order.
- The daily release (`scripts/release/`, `release.yml`) already decides which packages publish
  from commits (ADR-007). CI runs `bun run doctor` via `scripts/doctor-apps.ts` and checks
  Conventional Commit bodies with `scripts/release/check-commits.ts`. Those are the same
  pattern as kit: encode the rule once, run it everywhere.
- `sdxc doctor` (ADR-160) is deliberately read-only. Each finding already names a `fix`, often
  another `sdxc` command or a one-line file edit. Agents copy those strings and apply them by
  hand — the gap this ADR's kit backlog closes.
- Remix's own CLI ships `remix doctor --fix` for low-risk repairs. That pattern fits here as
  long as diagnosis stays separate from mutation.
- Generators already close the loop for _new_ app work: `make` declares and maps controllers,
  jobs, emails, MCP tools and commands; `make middleware --mount` edits a chain; `make model`
  writes the migration and factory. Gaps show up when something was written without `make`, or
  when the change is a binding, a Durable Object class, or another kind the stubs never covered.
- `@sdxc/codemod` (ADR-137) already powers declaration and mapping edits. Anything that is "add
  this import and this call in this file" can reuse that path.
- Monorepo-only scaffolding (`create-app` / `create-package` skills: Vitest project rows,
  `fmt.overrides`, workspace `package.json`) belongs under `scripts/`, the same way release and
  doctor already do — not inside the published kit, which consumer apps install.

## Decision

### Criterion

Encode a step in code — kit command, repo script, or workflow — when **all** of the following
hold:

1. **Deterministic.** Given the same project state and the same flags, two runs write the same
   files, the same report, or the same deploy plan. No product judgment, no "pick the nicer
   name", no release-note prose.
2. **Locally checkable.** A test (or a dry-run the CI can assert) can verify the before/after
   without a human reading the diff for intent.
3. **Named by a verb the agent already knows.** Prefer extending `sdxc …`, a root `bun run …`
   script, or a workflow_dispatch input over inventing a one-off recipe an `AGENTS.md` has to
   teach.
4. **Safer than the agent.** The command or workflow refuses or `--dry-run`s when the edit
   would be ambiguous, and production mutations keep confirmation / concurrency groups.

Everything else stays in docs, skills and agent judgment: architecture placement, consumer-facing
commit bodies, migration semantics on live data, UI copy, policy grants beyond the scaffold's
defaults.

### Pick the surface that matches the audience

| Audience / scope                                                                    | Surface                                                                         |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Any project on `@sdxc/*`                                                            | `@sdxc/kit` (`make`, `scaffold`, `setup`, `destroy`, `doctor`, `fix`, `deploy`) |
| This monorepo only (release, doctor-all-apps, package bootstrap, create-app wiring) | `scripts/` + root `package.json`                                                |
| Production or shared CI for this monorepo                                           | `.github/workflows/` calling those scripts or the kit binary                    |

A step that belongs in more than one place still has one owner: the kit owns the algorithm
(`sdxc deploy`); the workflow owns when and where it runs with repo secrets. Do not reimplement
deploy order inside YAML.

### Prefer generate over repair; prefer repair over narration; prefer a workflow over a playbook

| Situation                                                 | Mechanism                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Creating a new kind of file or wiring                     | `sdxc make` / `sdxc scaffold` (extend kinds and stubs)                          |
| Installing a cross-cutting feature into an existing app   | `sdxc setup <feature>` (edits app code _and_ config as one plan)                |
| Removing what `make` wrote                                | `sdxc destroy`                                                                  |
| Project drifted from a rule the kit can prove             | `sdxc doctor` reports; `sdxc fix` applies only named safe repairs               |
| Release moved and the code must follow                    | `sdxc upgrade` + its prompt (agent applies _code_ changes)                      |
| Ship an app in this monorepo                              | `Deploy app` workflow (or `sdxc deploy` locally); never hand-ordered `cf` calls |
| Publish packages / check every app / enforce commit shape | `bun run release`, `bun run doctor`, release commit check in CI                 |

`doctor` stays read-only (ADR-160). A separate `sdxc fix [check…]` (or `sdxc doctor --fix`
that only enables that path) applies repairs the report already knows how to express. A check
without a coded repair keeps printing prose; the agent still does that one. Never invent a
repair that `doctor` would not have named.

### `sdxc setup` for features that span app code and config

`make` writes one kind of file (and its declaration/mapping). Some features are not one file:
they need an initializer, middleware, controllers, routes, secrets, CSP entries, package pins
and a test helper, in a fixed graph. That is `sdxc setup <feature> [flags]` — a family of
installers, not a one-off for auth.

- **One plan, many files.** The command prints (and with confirmation writes) every path it
  will touch — app modules _and_ config — then runs package install / `typegen` when the plan
  added a dependency or a secret. `--dry-run` is the default agent path until `-y` / `--yes`.
- **A living app is the stub.** Each setup copies the shape from an app that already runs the
  feature (blog for OIDC, uptime for billing and flags), expressed as kit stubs and codemods
  instead of an agent reading those files.
- **Provider / backend is a flag when it varies.** `sdxc setup auth --provider r3-auth` (default)
  vs `--provider auth-saas` once that issuer is ready; `sdxc setup billing --provider polar`
  the same way. The app-side contracts (`@sdxc/auth`, `@sdxc/billing`) stay stable; only the
  backend URL, secrets and registration hints change.
- **Idempotent where possible.** A second run against an app that already has the feature
  reports what is present and only fills gaps (missing secret line, unmapped route), or refuses
  when a hand-edited file no longer matches the stub.
- **Opt-in, not the template default.** The `sdxc create` template stays lean (session actor,
  honeypot, Turnstile, mail, MCP skeleton). Features that every app does not need arrive through
  `setup`, so a project pays for OIDC, billing or flags only when it asks.

`setup` does not invent product policy: which abilities exist, who may sign in, which products
to sell, or which flags to define stay for the agent after the mechanical wiring is in place.

#### Feature catalog (auth first; others when the graph is stable)

| `sdxc setup …`   | What it wires                                                                                          | Living reference     |
| ---------------- | ------------------------------------------------------------------------------------------------------ | -------------------- |
| `auth`           | OIDC relying party, login/callback/logout, client secrets, CSP `formAction`, `signIn()` test helper    | blog                 |
| `billing`        | `@sdxc/billing` provider, middleware, webhook route, portal/checkout secrets, product catalog stub     | uptime               |
| `flags`          | `@sdxc/flags` + engine store, router/dispatcher middleware, empty catalog, wide-event hook             | uptime               |
| `hostname`       | `@sdxc/hostname` client, custom-hostname routes/services, zone secrets                                 | uptime (status)      |
| `storage` / `r2` | R2 binding, file-storage initializer, `.env.example` / typegen                                         | apps that use R2     |
| `cache`          | `@sdxc/workers-cache` (or cache middleware) on chosen routes                                           | apps that edge-cache |
| `activitypub`    | Federation initializer, routes, actor config, related jobs                                             | blog                 |
| `mcp` (harden)   | Turn the template's empty MCP skeleton into an authenticated/tool-ready server when that graph settles | template + apps      |

Ship one feature at a time. A row above is a candidate once its living reference has a
deterministic file list a test can assert — not a commitment to implement them together.
`sdxc setup` with no feature lists the ones this kit release knows, so agents discover the
catalog the same way they discover `make` kinds.

### Kit backlog (ordered by agent token cost vs. implementation risk)

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
   `sdxc run typegen` (or run it). Agents today hand-edit three places. `setup` reuses these
   for the secrets a feature needs.
5. **`sdxc make durable-object <Name>`.** Write the class under `app/models/` or
   `app/services/` (`--role`), re-export it from `bootstrap/worker.ts`, and declare the binding
   in `cloudflare.config.ts`. The class body stays a stub; placement is a flag, not a guess.
6. **`sdxc setup` command + `setup auth`.** Introduce the `setup` verb (list known features,
   `--dry-run` / `-y`, shared plan printer) and ship `auth` first against `r3-auth`, with
   `--provider` ready for auth-saas later. Graph from blog's relying-party wiring, reduced to
   the template's session/`actor` world. Reuse `make secret` / `make binding` for the secrets
   and bindings the plan needs.
7. **Next `setup` features after `auth` proves the pattern.** Prefer `billing` and `flags`
   (uptime already runs both) over inventing new graphs; add `hostname`, `storage`, `cache`,
   `activitypub` only when an agent still copies those by hand often enough to measure.
8. **Stop unbounded kit expansion.** Do not auto-rewrite JSDoc prose, move files between
   layout folders, or rewrite migration SQL. Do not fold template defaults (honeypot, Turnstile,
   mail) into `setup` until the template itself goes leaner on purpose.

Each kit item lands with tests, `--dry-run`, a line in the managed `AGENTS.md` section, and a
guide update so agents learn the verb from the release that ships it.

### Monorepo backlog (scripts / workflows, not the published kit)

These already illustrate the criterion; extend them the same way when a skill still describes a
hand recipe:

- Keep deploy and release as workflow_dispatch (or release-triggered) paths that call
  `sdxc deploy` / `bun run release` — agents dispatch or dry-run, they do not re-encode the
  plan in chat.
- When `create-app` / `create-package` stay multi-file hand edits, add a `bun run` script that
  writes the workspace files the skills list today, and point the skills at that script.

### What agents still own

- Choosing _whether_ to run `sdxc setup <feature>`, which resource to scaffold, and which
  fields matter.
- Filling stubs after a setup: handler bodies, policy nuance, email copy, UI, subject↔account
  mapping after `setup auth`, product catalog after `setup billing`, flag definitions after
  `setup flags`.
- Applying upgrade prompts that change call sites in app code.
- Writing Conventional Commit subjects and bodies for consumers (ADR-007 / ADR-140): the shape
  is fixed (and CI checks it), the content is not.
- Deciding _that_ an app should ship; the workflow or `sdxc deploy` owns _how_.
- Registering the OAuth client on the issuer (or confirming credentials): `setup` writes the
  app side and names the values; minting them on r3-auth / auth-saas stays an operator step
  until that server exposes an API the kit can call safely.

## Consequences

### Positive

- **Fewer tokens on boilerplate.** An agent runs one command or dispatches one workflow instead
  of reading a skill and inventing paths.
- **One algorithm, many runners.** Kit owns deploy order; GHA and local shells both call it.
  Release planning lives in `scripts/release/`, not in an agent's memory of ADR-007.
- **Clear boundary.** "Can we express this in a test or a dry-run?" is the gate, so tooling does
  not grow into an unsupervised refactor bot.
- **Feature installs stop being tribal knowledge.** `sdxc setup <feature>` replaces "read the
  living app and copy these eight files" with one command per cross-cutting concern.

### Negative

- **`fix` and `setup` are new mutation surfaces** in the kit. They need the same confirmation /
  `--yes` / `--dry-run` discipline as `destroy` and `deploy`, and CI must keep calling
  `doctor` without `--fix`.
- **Ambiguous projects stay manual.** A hand-rolled models index or a half-wired auth stack
  will not get a silent rewrite; `fix` / `setup` must refuse rather than guess.
- **Three surfaces to choose from.** Putting a monorepo-only step in the published kit (or
  reimplementing kit logic in YAML) creates two sources of truth; the audience table is the
  guardrail.
- **Providers move.** Auth issuers and billing backends change; each setup's `--provider` and
  docs must name the cutover, or agents wire the wrong host.
- **Catalog pressure.** Every new `@sdxc/*` concern will want a `setup` entry; the criterion
  (deterministic graph + living reference + measured agent cost) is what keeps the list short.

### Neutral

- Remix's `doctor --fix` is a precedent, not a dependency.
- Existing workflows and scripts already satisfy this ADR; the kit backlog is what is still
  missing for consumer apps and for agents working inside a generated project.

## Alternatives Considered

### 1. Teach agents better prompts only

**Rejected because**: `AGENTS.md` already teaches `make`, `doctor` and `sdxc deploy`, and
agents still spend turns on the mechanical steps. Documentation without a verb or a workflow
regresses on every model change.

### 2. Put `--fix` on `doctor` and allow any check to write

**Rejected as the default** because ADR-160's read-only contract is what makes `doctor` safe in
CI and in a loop. A dedicated `fix` command (or an explicit `--fix` that only enables coded
repairs) keeps the report path unchanged.

### 3. Autofix JSDoc, layout moves and migration SQL

**Rejected because**: those edits need intent. A wrong JSDoc rewrite or a silent `ALTER`
"repair" costs more than the tokens it saves.

### 4. Fold monorepo `create-package` into the published kit

**Rejected** because consumer apps do not create `@sdxc/*` workspaces. That scaffolding belongs
in this repository's `scripts/`, beside `release` and `doctor-apps`.

### 5. Encode deploy order only in GitHub Actions

**Rejected because**: local dry-runs and agents outside Actions still need the same order.
ADR-161 put it in `sdxc deploy`; workflows call that command.

### 6. Stretch `sdxc make` / `scaffold` instead of a `setup` verb

**Rejected because**: auth, billing and flags are not one resource with fields. Each is a fixed
graph across layers (`make` would leave the agent to remember the other seven files). `setup`
owns multi-file feature installs; `make` stays one kind per invocation.

### 7. Ship every optional feature only inside `sdxc create --template`

**Rejected as the only path** because existing apps need the same wiring, and a template that
always includes auth/billing/flags forces every project to carry secrets and middleware it does
not use. `create` may offer features as opt-in flags later by calling `setup` under the hood.

### 8. One mega `sdxc setup` that installs everything popular

**Rejected because**: apps diverge. A catalog of named features, installed deliberately, keeps
each plan small, testable and reversible.

## References

- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)
- [ADR-137: `@sdxc/codemod`](./ADR-137-codemod-package.md)
- [ADR-143: `sdxc make` Generators](./ADR-143-sdxc-make-generators.md)
- [ADR-160: `sdxc doctor`](./ADR-160-sdxc-doctor.md)
- [ADR-161: `sdxc deploy`](./ADR-161-sdxc-deploy.md)
- [ADR-162: `AGENTS.md` in Generated Projects](./ADR-162-agents-md-in-generated-projects.md)
- [ADR-163: `sdxc scaffold`](./ADR-163-sdxc-scaffold.md)
- Remix CLI `doctor --fix` (vendor docs under `docs/vendor/@remix-run/cli`)
- `.github/workflows/deploy-apps.yml`, `deploy-sdxc.yml`, `release.yml`, `ci.yml`
- `scripts/release/`, `scripts/doctor-apps.ts`

## Current Progress

- [x] Criterion recorded as Proposed (kit, scripts and workflows as one family)
- [ ] Accept or revise the criterion with Sergio
- [ ] Implement `sdxc fix` for command-shaped repairs (kit item 1)
- [ ] Implement `sdxc fix env` (kit item 2)
- [ ] Implement model/email registration repairs (kit item 3)
- [ ] Implement `make secret` / `make binding` (kit item 4)
- [ ] Implement `make durable-object` (kit item 5)
- [ ] Implement `sdxc setup` (list features, shared plan) + `setup auth` against r3-auth;
      defer `--provider auth-saas` until that issuer is ready for relying parties (kit item 6)
- [ ] After `setup auth`, add the next catalog row that still costs agent turns (`billing` /
      `flags` are the likely pair) (kit item 7)
- [ ] When create-app / create-package skills still describe hand recipes, add matching `scripts/`
- [ ] Measure agent turns before adding further kit kinds or `setup` features

## Notes

The test for a feature aimed at agents: after it ships, `AGENTS.md` (or the skill) can drop the
hand-edit recipe and name the command, script or workflow instead. If the docs still need a
paragraph of "then open these three files" or "then run these four shell commands in order",
the feature is not done. For any `setup <feature>`, success is: a fresh `sdxc create` app runs
`sdxc setup <feature> -y`, fills the secrets the plan names, and exercises the happy path
without an agent copying the living reference by hand.
