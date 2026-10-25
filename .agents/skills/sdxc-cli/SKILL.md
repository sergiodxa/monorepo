---
name: sdxc-cli
description: Drive this monorepo through the `sdxc` command line (@sdxc/kit) installed globally from this checkout. Use before writing any app file by hand (controller, middleware, validator, job, model, migration, factory, service, policy, initializer, email, MCP tool, command, secret, binding, Durable Object), when inspecting an app's routes, models, middleware, initializers or schedule, when checking a project with `sdxc doctor`, when running an app's own commands, when copying @sdxc/ui components, when deploying, or when changing the kit itself.
---

# sdxc CLI

`sdxc` on PATH is a shim that runs this checkout's kit, not the published one:

```sh
#!/bin/sh
exec bun /Users/sergiodxa/Developer/sergiodxa/monorepo/packages/kit/src/bin.ts "$@"
```

So an edit under `packages/kit/src` takes effect on the next `sdxc` call — no build, no
install. Always call `sdxc`; `bunx @sdxc/kit` or `npx sdxc` run an older npm release that
does not know about the kit's latest commands and checks.

## Check the install first

```sh
command -v sdxc && head -3 "$(command -v sdxc)"
```

The second line must point at `packages/kit/src/bin.ts` in the checkout you are working in.
When `sdxc` is missing, or points elsewhere (another clone, a global npm install), run
`bun packages/kit/src/bin.ts <command>` from the repo root instead and tell the user — do
not install or rewrite the shim yourself.

`sdxc ui` lists and copies components from `packages/kit/registry`, which is generated. Run
`bun run kit:registry` at the root after `packages/ui` changes, or `sdxc ui` serves stale copies.

## Where to run it

Commands act on the nearest directory with a `package.json`:

- **From `apps/<name>`** — everything that writes or reads app code: `make`, `scaffold`,
  `destroy`, `routes`, `models`, `doctor`, `run`, `deploy`, `ui`.
- **From the repo root** — `sdxc run` runs the monorepo's own command line (`cli/index.ts`,
  set as `run.entry` in `.config/sdxc.jsonc`): `sdxc run doctor` (every app plus the root
  checks), `sdxc run package create`, `sdxc run app register`, `sdxc run release`.
- **New app** — `sdxc create <directory>` from `apps/`, then `sdxc run app register <name>`
  from the root to add its Vitest project and layout entry.

## Never wait on a prompt

On a terminal every command asks for what you left out; an agent has no terminal. Discover
arguments as data, then pass every one as a flag:

```sh
sdxc make controller --help --json
sdxc make controller posts/show --dry-run   # see what it writes, then drop --dry-run
```

Commands that remove or deploy need `--yes` without a terminal — use it only after the user
asked for that exact removal or deploy.

## Write files with `make`, not by hand

`sdxc make <kind> <name>` puts the file where the app layout says, writes its test (and
`.spec` where one pairs), and declares and maps it (route contract, job map, MCP toolset,
command set, email registry). Then fill in the body.

```sh
sdxc make controller posts/show
sdxc make model post title author_id        # model, migration, factory
sdxc make migration add-slug-to-posts 'slug?'
sdxc make secret POLAR_TOKEN                 # cloudflare.config.ts + .env.example
sdxc make do Room                            # class, worker re-export, binding
sdxc scaffold post title body --api          # a whole resource
sdxc destroy controller posts/show --dry-run
```

`sdxc make --help` lists every kind. When a step has no verb, write it by hand and tell the
user the kit is missing that verb — a recurring hand-written step belongs in the kit.

## Read the app instead of grepping it

Each prints a table, or JSON with `--json`:

| Command             | Answers                                                       |
| ------------------- | ------------------------------------------------------------- |
| `sdxc routes`       | every route, its controller and middleware (`-g`, `--unused`) |
| `sdxc models`       | each model's table and whether a migration creates it         |
| `sdxc middleware`   | each router's global middleware and every chain               |
| `sdxc initializers` | each initializer, its exports and what builds them            |
| `sdxc schedule`     | scheduled jobs, next runs, and the triggers that fire them    |
| `sdxc notes`        | `TODO` / `FIXME` / `HACK` / `OPTIMIZE` comments               |

## Check and repair

```sh
sdxc doctor --json             # one app; read each finding's `fix`
sdxc doctor --only jsdoc       # narrow while iterating
sdxc fix --dry-run             # the repairs the kit can make safely
bun run doctor                 # root: every app plus .config/sdxc/checks, as CI runs it
```

`doctor` is read-only. Monorepo-only rules live as checks in `.config/sdxc/checks/` written
with `defineCheck` from `@sdxc/kit/doctor`; a rule every `@sdxc/*` project should follow
belongs in `packages/kit/src/doctor/` instead.

## Run and deploy

```sh
sdxc run db migrate            # the app's own command line (app/commands)
sdxc run db console
sdxc deploy --dry-run          # only when the user asked to deploy; print the plan first
sdxc deploy --skip migrate     # apps without a database
```

## Changing the kit

After adding or renaming a command, argument or flag, run `bun run kit:reference` at the
root; the kit's tests fail until `packages/kit/README.md` matches the contract. Verify a change
by running `sdxc` against a real app in `apps/` — the shim already serves your edit.
