---
title: Errors and FAQ
description: What the messages sdxc, sdxc doctor and a new app's tests print mean, why each happens and how to fix it, and answers to the questions a first app raises.
section:
    title: The sdxc command
    order: 2
order: 11
lastUpdated: 2026-10-25
outcomes:
    - "What each `sdxc doctor` failure means and the command that fixes it"
    - "What to do when `sdxc make`, `sdxc run` or `sdxc deploy` stops"
    - "Why a page answers 403, a cron job never runs, or local data seems to vanish"
---

Each entry starts from what you see, says why it happens, and gives the fix. Search this page
for the first words of a message.

## sdxc doctor

`sdxc doctor` prints a fix beside every failure and warning; this is the reason behind each.
[Check a project](/docs/sdxc/check-a-project) lists every check.

### "N @sdxc packages are behind release …"

These packages lag behind the newest date among the project's `@sdxc` pins. Mixed dates install
two copies of a shared package, whose context keys and `instanceof` checks then stop matching.
Run the `sdxc upgrade <release>` the line names.

### "N @sdxc packages are not pinned to a release"

A range such as `^2026.9.21` is in `package.json`, so each install may pick a different release.
The same `sdxc upgrade <release>` writes exact pins.

### "node_modules differs from package.json"

An install is out of date, usually after a pull or an upgrade. Run the install command the line
names, such as `bun install`.

### ".env.example leaves out a secret cloudflare.config.ts declares"

CI copies `.env.example` to `.dev.vars` before it type checks, so a secret only your own
`.dev.vars` holds type checks on your machine and fails there. `sdxc fix env` appends each
missing key; give it a development value.

### ".cloudflare/types/index.d.ts is older than what it is generated from"

`cloudflare.config.ts`, `.dev.vars` or `.env.example` changed after the Worker's `env` types were
generated, so `env` may type check against bindings the Worker no longer receives. Run
`sdxc run typegen`, or `sdxc fix`, which runs it for you.

### "A migration chain does not replay on an empty database"

A new database, and every new tenant, applies the whole chain from the first file, with SQLite's
double-quoted strings off, so a `"value"` meant as a string fails there. Correct the migration it
names. When production already
ran that file, list it under `doctor.migrations.accept` instead, as
[Check a project](/docs/sdxc/check-a-project#accept-a-migration-that-already-ran) shows.

### "The project strays from the app layout"

A folder in `app/` is one the layout does not have, or a module outside `bootstrap/` imports from
it. Move each file to the folder of its kind; `sdxc make <kind> --dry-run` prints where that is.
[How it fits together](/docs/getting-started/how-it-fits-together#where-each-kind-of-code-goes)
lists the folders.

### "Found 1 route no router maps" or "… mapping without lazy()"

A route is declared in `routes/` but mapped nowhere, so it answers 404; or a controller is
imported with the router, so every request loads it. Map it as
`router.map(route, lazy(() => import(…)))`. `sdxc routes --unused` lists what is left.

### "app/models/index.ts leaves out a model"

A file in `app/models/` calls `createModel` but the registry does not list it, so
`ctx.models.<name>` is undefined. `sdxc fix models` adds it to `createModels({ … })` as
`key: () => import("./<file>")`.

### "app/initializers/mail.ts maps no template for N declared emails"

An email is declared in `app/emails/index.ts` with no template mapped onto the registry, so every
send of it fails. `sdxc fix emails` maps it when its template file exists; otherwise write the
email with [`sdxc make email`](/docs/sdxc/make-email), which declares and maps it in one step.

## sdxc make and sdxc scaffold

### "… already exists; sdxc make leaves it as it is unless --force"

`make` leaves every existing file as it is, and it plans every file before it writes any, so
the project is as it was. Pick another name, or pass `--force` to write the file and its test
from the stub again; the declaration and mapping it already has are kept.

### "Declare and map it by hand, since no initializer in app/initializers/ creates …"

`make` wrote the file and its test, but found no initializer to add the mapping to, because the
project keeps it outside `app/initializers/`. Paste the declaration and the mapping it printed
where it says. [Generate files](/docs/sdxc/generate-files#when-an-edit-cannot-be-placed) has an example.

### "… is not a name; use letters, digits and dashes in each segment"

Each segment of a name becomes a file name and an identifier, so it starts with a letter and
holds only letters, digits and dashes. A slash makes a folder: `reports/daily`.

### "Added @sdxc/… to package.json; run bun install"

The new code imports a package the project did not list yet. `make` added it at the project's
release; run the install command before the dev server or the tests load the file.

### "Unknown command … for sdxc make"

The kind is misspelt or does not exist. `sdxc make --help` lists every kind.

### "… does not exist; sdxc destroy removes what sdxc make wrote"

`sdxc destroy` looks for the file `make` would have written for that kind and name. Check the
name against the file, as `reports/daily` for `app/jobs/reports/daily.ts`.

## sdxc run and sdxc deploy

### "bootstrap/cli.ts not found …; an app's command line starts there"

`sdxc run` runs the app's own command line from the nearest folder with a `package.json`, and
that folder has no `bootstrap/cli.ts`. Run it inside the app.

### "Deploying to production without a terminal needs --yes"

`sdxc deploy` asks before it changes production, and a run without a terminal, such as CI, has
no one to answer. Pass `--yes` there, after a step that runs `sdxc doctor`.

### "Listing pending migrations with db migrate --remote --pending failed"

The first remote step could not reach your Cloudflare account or database, and nothing was
migrated or deployed. Sign in with `bunx cf auth login`, or set `CLOUDFLARE_API_TOKEN` in CI, and
check that the `DB` binding in `cloudflare.config.ts` holds your database's id.

### ".config/sdxc.jsonc: … Unknown key"

Every command validates the configuration before it runs. Correct the key the line names;
[Configuration](/docs/sdxc/configuration) lists every one.

## A new app's tests

### "Cannot find package '@sdxc/sample'"

A factory imports `@sdxc/data-model/testing`, which generates its values with `@sdxc/sample`,
an optional peer the project has to install. Add it as a dev dependency at the project's
release, such as `bun add -d @sdxc/sample@2026.10.13`.

### "Cannot read properties of undefined (reading 'DEV')"

A page test renders an `@sdxc/ui` component, which reads `import.meta.env.DEV` to decide whether
to warn about a missing accessible name. Vitest leaves `node_modules` untransformed, so
`import.meta.env` is undefined there. Have Vitest transform the package in `vite.config.ts`:

```ts {% title="vite.config.ts" %}
test: {
	server: { deps: { inline: ["@sdxc/ui"] } },
},
```

### A generated case fails after you change a rule

The tests `sdxc` writes record what the code did when it was written, such as a guest getting a
403 from a form. When you change that on purpose, rewrite the case to say what the app does now.

## Questions a first app raises

### Why does the new form answer 403?

The policy `sdxc scaffold` and `sdxc make policy` write lets everyone read and only signed-in
members write, and a new app signs no one in. Grant the ability to everyone in
`app/policies/policy.ts`, or sign members in; the session holding an `actor` is what makes a
visitor a member. [Build an app](/docs/getting-started/build-an-app#let-guests-add-bookmarks)
does the first.

### Why did my local data disappear after I set up the database?

The local database file is named after the `DB` binding's id, so writing your real D1 id into
`cloudflare.config.ts` points `bun dev` at a new, empty file. Run `sdxc run db migrate` again to
create the tables there; the old file stays under `.cloudflare/state/`.

### Why does my cron job never run?

Cloudflare fires only the schedules the Worker declares in `triggers.scheduled({ schedule })` in
`cloudflare.config.ts`. `sdxc make job` with `--cron` adds the trigger, so the job that lacks one
was declared by hand. [`sdxc schedule`](/docs/sdxc/inspect-a-project#scheduled-jobs) names the
trigger to add; add it and deploy.

### Why does `env.MY_SECRET` not type check?

The types are generated from `cloudflare.config.ts`. `sdxc make secret MY_SECRET` declares it
there with `bindings.secret()` and adds it to `.env.example`; then run `sdxc run typegen`.

### Can I undo a migration?

`sdxc` applies migrations forward only. Write a new migration that reverses the change, with
`sdxc make migration`, and apply it; production keeps one history that every new database
replays.

### Is `db.transaction()` atomic on D1?

D1 commits each statement as it runs, so a failure halfway leaves the earlier statements
applied. Write a change that spans several rows as one statement, such as an upsert, or with
steps that undo the earlier ones when a later one fails.

### Do I need `sdxc` installed globally?

A project from `sdxc create` lists `@sdxc/kit` in its `devDependencies`, so `bunx sdxc …`
runs the version the project pins, which is what CI uses. A global install saves typing `bunx`.

## Where to go next

- [Glossary](/docs/sdxc/glossary) — the terms these messages use.
- [Check a project](/docs/sdxc/check-a-project) — every check, and adding your own.
