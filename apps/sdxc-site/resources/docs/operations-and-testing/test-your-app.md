---
title: Test your app
description: Read the tests sdxc make and sdxc scaffold write beside each file, run one file or one case while you work, and turn a generated test into one that pins your app's behavior.
section:
    title: Operations & testing
    order: 9
order: 2.5
lastUpdated: 2026-10-25
outcomes:
    - "What each test `sdxc make` writes checks, and what is left for you"
    - "How to run every test, one file, one case or one line"
    - "How the test helpers in `app/test/` give a test the app's real router and database"
---

Every file `sdxc make` and `sdxc scaffold` write comes with a test beside it, so a new app
starts with a passing suite and every feature you add has a place for its cases. This guide
starts from those tests. [Test Workers apps](/docs/operations-and-testing/testing) covers the
configuration under them: the Workers pool, the in-memory mocks and MSW.

## Run the tests

```bash
bun run test
```

`bun run test` runs the project's `test` script, `vp test run`: [Vitest](https://vitest.dev)
through Vite+, over every `*.test.ts` and `*.test.tsx` under `app/` and `resources/`. Anything
after the script name reaches Vitest, so you narrow a run the way Vitest does.

| To run…                       | Type                                                     |
| ----------------------------- | -------------------------------------------------------- |
| one file                      | `bun run test app/models/bookmark.test.ts`               |
| every file whose path matches | `bun run test bookmarks`                                 |
| the cases whose name matches  | `bun run test app/http/controllers/bookmarks -t "guest"` |
| the case on one line          | `bun run test app/models/bookmark.test.ts:29`            |
| again on every save           | `bunx vp test watch app/models`                          |

A path is matched as a substring, so `bun run test bookmarks` runs the model's, the
validator's, the policy's and every page's tests for the resource at once. The line number is
the one the case's `test(` call starts on; any other line answers "No test found".

Before you commit, run `bun check` too: it type checks the test files, so a case that calls a
renamed method fails there even when it is skipped.

## Read what each generated test checks

`make` writes the test that proves the file loads and is wired in, and leaves the cases about
your rules to you. That keeps a fresh suite green, and Vitest lists each `test.todo` as a gap to
fill.

| Kind          | The generated test                                                    | You add                            |
| ------------- | --------------------------------------------------------------------- | ---------------------------------- |
| controller    | the module exports what the router maps, and a `test.todo`            | what the page answers              |
| validator     | a complete submission passes, and one missing a field fails           | each rule you add to the schema    |
| model         | the model is defined over its table, and a `test.todo`                | each method and callback           |
| policy        | who may read, create, update and delete                               | each condition you add to a grant  |
| job, MCP tool | the handler is exported where it is mapped, and a `test.todo`         | the work                           |
| command       | the command runs through the app's CLI and exits 0, and a `test.todo` | its output and effects             |
| middleware    | the factory returns a middleware                                      | what it publishes or answers       |
| service       | the function succeeds                                                 | each outcome its callers branch on |
| email         | its preview props render into the subject and both body parts         | the copy your app sends            |
| initializer   | the instance is built at import                                       | how it is configured               |

`sdxc scaffold` writes fuller tests: the model's reads back a row the factory creates, and the
pages' create rows with the factory, sign a member in, and submit the forms with valid honeypot
fields, so the page, the policy and the validator all run as in the Worker. Use them as the model for a controller's own cases.

> [!NOTE]
> A generated test is a starting point you own. When you change a rule on purpose, a generated
> case that encoded the old rule fails; rewrite it to say what the app does now, as
> [Build an app](/docs/getting-started/build-an-app#run-the-tests) does when guests may post.

## Use the helpers in app/test

The template and the scaffold put what every test needs in `app/test/`, so a test reads like
the code it checks:

- **`app/test/database.ts`** has `migrate()`, which
  applies every migration in `database/migrations/` to the in-memory `DB` binding, and
  `factories()`, which writes rows through your own models. Call `migrate` once per file in
  `beforeAll`; each file starts with an empty database.
- **`app/test/session.ts`** has `signIn(actor?)`, which answers the session cookie of a
  signed-in member, for a request that needs one.
- **`app/test/cloudflare-workers.ts`** stands in for `cloudflare:workers` under Vitest, so a
  module that imports `env` loads in a test as it does in the Worker. Its `EMAIL` binding keeps
  every message sent through it on `messages`.
- **`app/test/local-database.ts`** has `useTemporaryProject(migrations)`, which points the
  command line at a temporary project, so a command's test runs `db migrate` and `db seed`
  without touching your local database.

A page test builds the router the Worker builds and sends it a `Request`:

```ts {% title="app/http/controllers/bookmarks/index.test.tsx" %}
import { beforeAll, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { factories, migrate } from "~/app/test/database";
import { BookmarkFactory } from "~/database/factories/bookmark";
import routes from "~/routes/web";

beforeAll(migrate);

test("lists each bookmark, linking to its page", async () => {
	let row = await factories().create(BookmarkFactory);

	let response = await createWebRouter().fetch(
		new URL(routes.bookmarks.index.href(), "https://example.com"),
	);

	expect(response.status).toBe(200);
	expect(await response.text()).toContain(
		`href="${routes.bookmarks.show.href({ id: row.id })}"`,
	);
});
```

Every middleware in the chain runs, the database included, so the test catches a route that is
declared but not mapped, a policy that refuses the visitor, and a view that fails to render. A
link built with the contract's `href()` keeps the test passing when you change the URL pattern.

## Test a rule where it lives

Put each case beside the code that holds the rule, and test it there with the least set-up:

- A rule about one model is a method on the model; test it with `factories()` and
  `Model.bind({ db: openDatabase() })`, as the model's own test does.
- A job's work is usually that method, or a service; test it there and keep the job's test to
  the mapping.
- A rule about who may do something is a grant in `app/policies/policy.ts`; test it with
  `testAccess(policy, { roles, facts })`, as the policy's test does, without a request.
- A schema's rule is tested by `validate(form, Schema)` on a `URLSearchParams`.
- An email's copy is tested by `mail.render(emails.teams.invite, { props })` from
  `app/initializers/mail.ts`, as the email's own test does; a page that sends one checks
  `env.EMAIL`'s `messages`, and `app/initializers/mail.test.ts` fails on a declared email with no
  template mapped.

The page test then needs one case per outcome a visitor sees, rather than one per rule. When a
case creates rows, override only the field it is about, and let the factory fill the rest:

```ts
let old = await factories().create(BookmarkFactory, { title: "Old link" });
```

## Where to go next

- [Test Workers apps](/docs/operations-and-testing/testing) — real bindings in the Workers pool,
  MSW for outbound HTTP, and mail and jobs recorded in memory.
- [Generate files](/docs/sdxc/generate-files) — the flags that write a test, or skip one.
- [Generate believable test data](/docs/operations-and-testing/test-data) — factories, traits
  and seeds for the rows a case creates.
