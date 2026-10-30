---
title: Build an app
description: Build a small link board from an empty folder to a deployed Worker, creating the project, scaffolding a resource, changing its validator and policy, adding a scheduled job, testing it and deploying it.
section:
    title: Getting started
    order: 1
order: 3
lastUpdated: 2026-10-25
outcomes:
    - "How `sdxc create`, `sdxc scaffold` and `sdxc run db migrate` take you from an empty folder to working pages"
    - "Where a validator, a policy, a model method and a job go, and how to change each one"
    - "How to run the tests `sdxc` wrote for you and ship the app with `sdxc deploy`"
---

In this guide you build **links**, a public link board: anyone can add a bookmark with an
`https` link, signed-in members edit and delete them, and a job removes bookmarks older than 30
days every night. Each step uses one `sdxc` command and then changes what it wrote, so by the
end you have touched every layer an app has.

You need [Bun](https://bun.sh) to run it locally and a
[Cloudflare account](https://dash.cloudflare.com/sign-up) for the last step. The guide assumes
you have written a [Cloudflare Worker](https://developers.cloudflare.com/workers/) and know
[Remix](https://remix.run) routes and controllers; it covers what `sdxc` adds on top.

## Create the project

Install the `sdxc` command and create the app:

```bash
npm add -g @sdxc/kit
sdxc create links
```

`create` writes a Remix app on Cloudflare Workers with a router, a D1 database, a job queue,
email, an MCP endpoint and their tests already wired together, and copies `.env.example` to
`.dev.vars` for the development secrets. Install the dependencies, generate the Worker's `env`
types, and start the dev server:

```bash
cd links
bun install
sdxc run typegen
bun dev
```

Open the address `bun dev` prints and leave the server running; the next steps reload it as
files change.

## Scaffold the bookmarks

A bookmark has a title, a link and optional notes. `sdxc scaffold` writes everything a resource
needs from its name and fields:

```bash
sdxc scaffold bookmark title link_url 'notes?:text'
```

A field's name picks its type, so `link_url` is a URL because it ends in `_url`, and `title` is
a string. `notes?:text` names the type itself, and the `?` makes it nullable; quote it so your
shell leaves the `?` alone.

It writes the model, validator, policy, controllers, views, a migration and a test beside each,
then wires them in: the routes go in `routes/web.ts` and the router, the model becomes
`ctx.models.bookmark`, and the abilities join the app's policy. Install the packages the new
code imports:

```bash
bun install
```

[Scaffold a resource](/docs/sdxc/scaffold-a-resource) lists what each file does.

## Create the table

The scaffold wrote `database/migrations/0001_CreateBookmarks.sql`. Apply it to the local
database, the same one `bun dev` serves:

```bash
sdxc run db migrate
```

```text
Applied 0001_CreateBookmarks.sql
```

Open `/bookmarks`: the list is empty, and **New bookmark** answers 403. That is the policy at
work, and the next step changes it.

## Let guests add bookmarks

The scaffold granted reads to everyone and every write to signed-in members. A link board where
anyone may post needs `bookmark.create` for everyone too, while updates and deletes stay with
members. Grants live in `app/policies/policy.ts`:

```ts {% title="app/policies/policy.ts" %}
const policy = definePolicy(abilities, {
	facts: { actor: fact<Actor>({ optional: true }) },
	everyone: [
		allow(["bookmark.read", "bookmark.create"], { id: "bookmark-read-create" }),
	],
	roles: {
		member: [
			allow(["bookmark.update", "bookmark.delete"], { id: "bookmark-write" }),
		],
	},
});
```

Run the policy's test to see what that changed:

```bash
bun run test app/policies
```

The case "refuses a guest every write" fails, because a guest may now create one. The test is
the record of who may do what, so change it to say so:

```ts {% title="app/policies/bookmark.test.ts" %}
test("lets a guest read and create one", () => {
	let guest = testAccess(policy, { roles: [] });

	expect(guest.can(abilities.bookmark.read, { bookmark: RECORD })).toBe(true);
	expect(guest.can(abilities.bookmark.create)).toBe(true);
});
```

Rename the old case to "refuses a guest an update or a delete" and drop its `create` line. Reload
`/bookmarks/new` and the form appears. [Authorization](/docs/identity-and-security/authorization)
covers conditions, such as letting members change only their own bookmarks.

## Accept only https links

`app/http/validators/bookmark.ts` holds the schema a submission passes before the create action
trusts it. The scaffold accepts any URL; a link board should send its readers to `https` only:

```ts {% title="app/http/validators/bookmark.ts" %}
export const BookmarkSchema = f.object({
	title: f.field(s.string().refine((value) => value.trim() !== "", "Required")),
	link_url: f.field(
		s
			.string()
			.refine(
				(value) => URL.parse(value)?.protocol === "https:",
				"Expected an https URL",
			),
	),
	notes: f.field(
		s
			.defaulted(s.string(), "")
			.transform((value) => (value.trim() === "" ? null : value)),
	),
});
```

Add the case to its test, beside the two the scaffold wrote:

```ts {% title="app/http/validators/bookmark.test.ts" %}
test("refuses a link that is not https", async () => {
	let form = new URLSearchParams({ title: "Remix", link_url: "http://remix.run/" });

	expect(isFailure(await validate(form, BookmarkSchema))).toBe(true);
});
```

A refused submission renders the form again with the message beside the field, so submit
`http://remix.run` on `/bookmarks/new` to see it.
[Forms and params](/docs/building-remix-apps/forms-and-params) covers the schema API.

## Prune old bookmarks every night

Removing old bookmarks is a rule about one model, so it is a method on that model; a job then
calls it on a schedule. Add the method in `app/models/bookmark.ts`:

```ts {% title="app/models/bookmark.ts" %}
import { column as c, lt, table } from "remix/data-table";

export const Bookmark = createModel(bookmarkTable, {
	generateId: generateUUID,
	methods: {
		/** Deletes every bookmark created before `cutoff`, so the board shows recent links. */
		pruneOlderThan(cutoff: Date) {
			return this.query().where(lt("created_at", cutoff.getTime())).delete();
		},
	},
});
```

Test it in `app/models/bookmark.test.ts`, where the factory the scaffold wrote creates a row:

```ts {% title="app/models/bookmark.test.ts" %}
test("prunes the bookmarks created before the cutoff and keeps the rest", async () => {
	let bookmarks = Bookmark.bind({ db: openDatabase() });
	let kept = await factories().create(BookmarkFactory);

	await bookmarks.pruneOlderThan(new Date(Date.now() - 60_000));
	expect(await bookmarks.find(kept.id)).not.toBeNull();

	await bookmarks.pruneOlderThan(new Date(Date.now() + 60_000));
	expect(await bookmarks.find(kept.id)).toBeNull();
});
```

Now write the job that runs it at 03:00 every day:

```bash
sdxc make job bookmarks/prune --cron "0 3 * * *"
```

```text
Wrote app/jobs/bookmarks/prune.ts
Wrote app/jobs/bookmarks/prune.test.ts
Edited app/jobs/index.ts
Edited app/initializers/dispatcher.ts
Edited cloudflare.config.ts
✓ Formatting 5 files
```

Cloudflare fires only the schedules the Worker declares, so `--cron` also adds the trigger to
`cloudflare.config.ts`. Fill in the handler, which reads the model through `ctx.models` as a controller does:

```ts {% title="app/jobs/bookmarks/prune.ts" %}
/** How long a bookmark stays on the board. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export default createJobHandler(jobs.bookmarks.prune, async (ctx) => {
	ctx.log.set({ job: { name: "prune" } });
	await ctx.models.bookmark.pruneOlderThan(new Date(Date.now() - MAX_AGE_MS));
});
```

Delete the `test.todo` in `app/jobs/bookmarks/prune.test.ts`: the rule it would test is covered
on the model. `sdxc schedule` confirms the job and its trigger line up:

```bash
sdxc schedule
```

```text
Job              Schedule   Next run              Trigger
bookmarks.prune  0 3 * * *  2026-10-20 03:00 UTC  cloudflare.config.ts
```

## Run the tests

```bash
bun run test
```

> [!NOTE]
> If a file fails before any of its cases run, with `Cannot find package '@sdxc/sample'` or
> `reading 'DEV'`, [Errors and FAQ](/docs/sdxc/errors-and-faq#a-new-app-s-tests) has the one-line
> fix for each.

One case fails: `app/http/controllers/bookmarks/new.test.tsx` still expects a guest to get a
403 from the form. Replace that case with the behavior you chose:

```ts {% title="app/http/controllers/bookmarks/new.test.tsx" %}
test("lets a guest add a bookmark", async () => {
	let page = await form(null);
	let response = await submit(
		{ title: "Remix", link_url: "https://remix.run/" },
		null,
	);

	expect(page.status).toBe(200);
	expect(response.status).toBe(303);
});
```

```bash
bun run test
```

```text
 Test Files  33 passed (33)
      Tests  77 passed (77)
```

The page tests drive the app's real router, so the policy and the validator run as they do in
the Worker.

## Check the project

Two more commands catch what tests do not:

```bash
bun check
sdxc doctor
```

`bun check` formats, lints and type checks. `sdxc doctor` checks the project itself, such as
every `@sdxc` package on one release and the migrations replaying on an empty database;
[Check a project](/docs/sdxc/check-a-project) lists each check and its fix.

## Deploy

The first deploy needs the Cloudflare resources the app binds: the D1 database, the sessions KV
namespace, the queue and the secrets. [Deploy your app](/docs/getting-started/first-deploy)
creates each one; do that once, then preview the plan:

```bash
sdxc deploy --dry-run
```

```text
App:        links
Build:      built just now
Migrations: 1 pending
  0001_CreateBookmarks.sql
Deploy:     the app's deploy command
```

```bash
sdxc deploy
```

`sdxc deploy` builds, applies the pending migrations to production, and then deploys, after you
answer yes, so the new code never runs against the old schema.
[Deploy](/docs/sdxc/deploy) covers what happens when a step fails.

## Where to go next

- [How it fits together](/docs/getting-started/how-it-fits-together) — what happens between a
  request reaching the Worker and your controller answering it.
- [Generate files](/docs/sdxc/generate-files) — every kind `sdxc make` writes.
- [Sign in with OpenID Connect](/docs/identity-and-security/sign-in-with-oidc) — sign members in,
  so the edit and delete pages open for them.
