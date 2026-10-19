---
title: Start a project
description: Write a new project from the built-in template or any GitHub repository, then configure the command line with one commented file.
section:
    title: The sdxc command
    order: 2
order: 1
lastUpdated: 2026-10-19
outcomes:
    - "How `sdxc create` writes a project from the built-in template or a GitHub repository"
    - "What a new project holds and which commands to run first"
    - "How to change the command line's defaults with `.config/sdxc.jsonc`"
---

`sdxc create` writes a new project in the folder layout every other `sdxc` command expects, and
`sdxc init` writes the one file that changes the command line's defaults.

## Create a project

```bash
sdxc create my-app
```

```text
Created my-app from the app template

Next steps:
  cd my-app
  bun install
  bun dev
```

`create` writes the built-in `app` template into `my-app`: a Remix v3 Worker on Cloudflare,
with `cloudflare.config.ts`, a Vite+ configuration, a test runner and its own command line in
`bootstrap/cli.ts`. It completes the template for the new project:

- `package.json` takes the folder's name, lower-cased with any character npm refuses turned
  into `-`.
- Each `@sdxc` package the template lists is pinned to its latest release, and `remix` to the
  version those releases need, so the project starts on one release date.
- `.env.example` is copied to `.dev.vars`, so the development secrets it lists are in place for
  the first `bun dev`.
- `.config/sdxc.jsonc` is written with every setting spelled out and `format` set to
  `bunx vp fmt --no-error-on-unmatched-pattern`, so the files later commands write match the
  project's checks.
- Every TypeScript module credits you in its `@author` and `@copyright` tags, from your git
  user.

<note>
`create` writes files and runs nothing from them: it installs no dependencies and runs no
scripts, and prints the commands to run next with the project's package manager.
</note>

### Where it writes

The target folder must be missing or empty apart from a `.git` folder, so `git init` before
`create` works too. A folder holding anything else stops the command, naming what is in the way,
and an existing project is never written over. Without a directory, `create` writes into the
current one, and on a terminal it asks where.

When it made the folder, it asks whether to initialize git there, and Enter says yes. `--git`
and `--no-git` answer in advance; without a terminal the answer is no. A folder that already
existed is left as it is, and a missing `git` is noted and skipped.

### What you get

The `app` template is laid out by kind of code, the layout
[`sdxc make`](/docs/sdxc/generate-files) writes into:

```text
bootstrap/        worker.ts, browser.ts, cli.ts, console.ts: the entry points
app/http/         controllers, middleware, validators
app/initializers/ the router, database, dispatcher, mail registry, MCP handler and command line
app/commands/     about, console, db (migrate, seed, fresh, prepare, console), emails preview,
                  deploy, typegen
app/emails/       index.ts, the email registry
app/jobs/         index.ts, with the job that delivers queued email
app/policies/     abilities.ts, policy.ts
app/mcp/  app/models/  app/services/  app/test/
config/           security headers, security.txt, problem types
database/         migrations/, seed.ts
resources/        layouts/, locales/
routes/           web.ts, api.ts
```

It serves a home page, `robots.txt`, a sitemap, an API with a health check and an OpenAPI
document, and an MCP endpoint, and while `bun dev` runs, `/_emails` previews every email the
app declares. Its `package.json` has `dev`, `build`, `start`, `check`, `test`, `typecheck` and
`cli` scripts.

The authorization, email and seed files start empty, ready for the commands that fill them:
[`sdxc make policy`](/docs/sdxc/make-policy) declares a resource's abilities,
[`sdxc make email`](/docs/sdxc/make-email) declares and maps an email, and `database/seed.ts`
holds the steps [`sdxc run db seed`](/docs/sdxc/run-app-commands) runs.

## Start from your own template

Any GitHub repository is a template as well, with no manifest to declare. Name it as
`org/repo`, with a folder inside it and a branch, tag or commit when you need them:

```bash
sdxc create blog --template acme/templates/apps/blog#main --no-git
```

The repository's files are written as they are, and its `package.json`, when it has one, takes
the project's name; nothing else is changed. `GITHUB_TOKEN` or `GH_TOKEN` in the environment
authenticates the download, which a private repository needs. When GitHub refuses it and no
token is set, a terminal asks for one, used for that download alone.

`--template app` names the built-in template, and on a terminal `create` asks which one to use.

## Instructions for your agent

The `app` template also writes `AGENTS.md`, the instructions AI coding agents read: the
commands, where each kind of code goes, and the rules for code built on these packages, between
`<!-- sdxc:start … -->` and `<!-- sdxc:end -->`. `CLAUDE.md` imports it for Claude Code. Add
your own rules below that section; [`sdxc upgrade`](/docs/sdxc/upgrade) rewrites the section
from each new release and keeps the rest.

## Your first resource

```bash
sdxc create my-app && cd my-app
bun install
sdxc scaffold post title body:text
sdxc run db migrate
bun dev
```

[`sdxc scaffold`](/docs/sdxc/scaffold-a-resource) writes the model, migration and pages,
`sdxc run db migrate` applies the migration to the local database, and `/posts` lists, creates,
edits and deletes posts. [Build an app](/docs/getting-started/build-an-app) takes the same start
through a policy, a validator, a job, the tests and a deploy.

## Configure the command line

Every setting has a default, so a project needs no configuration file until it changes one.
`sdxc init` writes `.config/sdxc.jsonc` with every key spelled out, and a `$schema` your editor
completes them from; `--dry-run` prints it instead:

```jsonc {% title=".config/sdxc.jsonc" %}
{
	"$schema": "https://unpkg.com/@sdxc/kit/config.schema.json",
	"ui": {
		// Where `sdxc ui add` writes components
		"directory": "resources/components/ui",
		// Import prefix for the copies; inferred from tsconfig `paths` when omitted
		// "alias": "~/components/ui",
		// Copy a component's tests beside it
		"tests": false,
	},
	"make": {
		// Route contract `sdxc make controller` adds to, a module in routes/
		"routes": "web",
		// Migration chains by name; `--chain <name>` picks one
		"migrations": { "default": "database/migrations" },
		// Write a test beside every generated file except migrations and factories
		"tests": true,
		// Stubs here replace the built-in ones; `sdxc make stubs` copies them out
		"stubs": ".config/sdxc/stubs",
	},
	"doctor": {
		// Folder of the project's own checks, each module run by `sdxc doctor`
		"checks": ".config/sdxc/checks",
		"migrations": {
			// Migration errors `sdxc doctor` steps past, each a file that already ran and the column its error names
			"accept": [],
		},
	},
	// Command run on every file the CLI writes or edits, paths appended
	// "format": ["bunx", "vp", "fmt", "--no-error-on-unmatched-pattern"],
	// Where the CLI keeps its state; commit it with the project
	"lock": ".config/sdxc.lock.jsonl",
}
```

The file is JSON with comments, so each setting can say why it is set. `format` is the one most
projects set: a generated file and a copied component then come out in your project's style.
It is an argument list run without a shell, once per command, with the written paths appended.

<note>
`sdxc.jsonc` at the project root is read too, when you prefer it there; a project with both
files is refused until you delete one. `init` leaves a configuration file that exists as it
is.
</note>

Every command validates the file before it runs. A misspelt key, a value of the wrong type, or a
path outside the project stops the command with one line per problem:

```text
.config/sdxc.jsonc: make.test: Unknown key
```

[Configuration](/docs/sdxc/configuration) covers every key, its default and the command it
changes.

## Where to go next

- [Generate files](/docs/sdxc/generate-files) — add controllers, jobs, models and the rest
  where the layout puts them.
- [Scaffold a resource](/docs/sdxc/scaffold-a-resource) — a model with its pages in one command.
- [`@sdxc/kit`](/api/kit) — every command and configuration key.
