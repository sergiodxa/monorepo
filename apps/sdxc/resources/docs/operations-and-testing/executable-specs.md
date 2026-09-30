---
title: Write executable specs
description: Describe your running app's behavior in .spec files, run them against a dev server with named grants, and gate CI on them.
section:
    title: Operations & testing
    order: 8
order: 5
lastUpdated: 2026-09-29
---

A Vitest suite checks your code from the inside. An executable spec checks the running app from
the outside, the way a visitor or an API client meets it: a URL, a request, a response.
[`@sdxc/spec`](/api/spec) reads `.spec` files written in a small language of setup, action and
expectation, with no branches, loops or operators, so a spec reads the same to the person who
owns the behavior as to the one who wrote the code. Each test runs in a fresh temporary
workspace, and every privileged act, from reaching the network to reading an environment
variable, needs a grant you name on the command line.

This guide writes a suite for an events app served by its dev server, generates the input it
posts, shares steps between tests, grants exactly what the suite touches, and runs it in CI.
The unit and integration side lives in [Test Workers apps](/docs/operations-and-testing/testing).

```bash
npm add -D @sdxc/spec
```

The `spec` command runs on [Bun](https://bun.sh), so keep `bun` on your `PATH`, locally and in
CI.

## Point the suite at your app

A suite is a directory, conventionally `spec/`, scanned for `.spec` files. Its configuration
names the app it talks to, so no spec has to repeat a host:

```json {% title="spec/config.jsonc" %}
{
	"bases": {
		"web": { "env": "APP_BASE_URL", "default": "http://localhost:8787" }
	}
}
```

A target written as `/path` resolves against this base. It reads `APP_BASE_URL` first and
falls back to the dev server's address, so the same suite runs against a laptop, a preview
deployment or CI by changing one variable. The file is JSONC, so comments and trailing commas
are allowed.

## Write a spec

A `test` has up to three phases, always in this order: `given` arranges, `when` acts and `then`
asserts. `let` binds what a step returns, and a dotted path reads into it:

```text {% title="spec/events.spec" %}
use http
use html

test "the home page lists upcoming events" {
	when {
		let page = http.get "/"
	}
	then {
		expect page.status 200
		expect html.title page.text "Upcoming events"
		expect html.element page.text heading "Upcoming events"
		expect html.element page.text link "Remix meetup"
	}
}

test "the calendar feed is served as iCalendar" {
	when {
		let feed = http.get "/events.ics"
	}
	then {
		expect feed.status 200
		expect feed.text contains "BEGIN:VCALENDAR"
	}
}

test "the API answers an unknown event with a problem" {
	when {
		let response = http.get "/api/events/missing"
	}
	then {
		expect response.status 404
		expect response.json.title "Not Found"
	}
}
```

`use` imports a namespace for this file, so `http.get` could also be written `get`; the
qualified form reads better beside `html`. Every `http` verb returns
`{ status, ok, headers, text, json }`, and an error status is an ordinary value to assert on,
which is how the last test checks a problem-details body.

`expect` with two values compares them structurally, and `contains` checks a substring or an
array member. The `html` namespace reads a page's markup with no browser: `title` and `meta`
read what the document says about itself, and `element` finds an element the way a person
perceives it, by role and accessible name. Names match exactly, and a name that matches twice is
an error listing both, so an assertion never silently picks the nav link over the one in the
page.

## Run it, and read the denial

Run the suite with no flags first:

```bash
npx spec run spec
```

```text
✗ Permission denied: net (3 tests)

  The spec attempted to reach:
  > http.get

  Re-run with an appropriate permission, for example:
  > spec run --allow-net

  Affected tests:
  - the home page lists upcoming events (spec/events.spec:6)
  - the calendar feed is served as iCalendar (spec/events.spec:18)
  - the API answers an unknown event with a problem (spec/events.spec:28)
```

Nothing was sent. Reaching the network is a privilege, and the runner refuses it before the
request is built, collapsing every test denied for the same reason into one block. Grant
exactly the host and port the base resolves to:

```bash
npx spec run spec --allow-net=localhost:8787
```

```text
seed spec (replay with --seed=spec)
run munddy0jqq0q (replay with --run-id=munddy0jqq0q)
base "web" → http://localhost:8787

✓ the home page lists upcoming events
✓ the calendar feed is served as iCalendar
✓ the API answers an unknown event with a problem

3 passed, 0 failed (6ms)
```

The header names the seed and the run id that replay this exact run, and the address each base
resolved to, so a run says which app it reached. A grant scoped to a different host is denied
with the resolved `host:port` in the suggested flag, ready to copy.

## Post forms with generated input

A sign-up needs a person to sign up. Typing one into the file makes every run post the same
literal; `sample` draws believable names and addresses instead:

```text {% title="spec/accounts.spec" %}
use http
use html
use sample
use spec
use str

test "a visitor signs up and lands on their profile" {
	given {
		let who = sample.person
		let handle = format "${name}-${nonce}" {
			name: who.username
			nonce: spec.nonce
		}
	}
	when {
		let profile = http.post "/accounts" form {
			email: who.email
			name: who.full_name
			username: handle
		}
	}
	then {
		expect profile.status 200
		expect html.element profile.text heading who.full_name
	}
}

test "a sign-up without an email is refused" {
	when {
		let response = http.post "/accounts" form { email: "", name: "Ada" }
	}
	then {
		expect response.status 422
		expect html.text response.text "Enter your email"
	}
}
```

`form` sends the object as `application/x-www-form-urlencoded`; `json` and `text` are the
other body tags, and `headers`, `bearer` and `basic` ride along on the same call. An object
literal may span lines, which is how a long body stays readable while a statement otherwise
ends at its newline.

Your app answers the sign-up with a `303` to the new profile. `http` follows redirects and
checks every hop against the grant, so `profile` is the page the visitor lands on, and a
redirect to a host you did not grant is refused rather than followed.

A test's `sample` draws follow its identity, the run's seed plus the test's file and title,
so the same test posts the same person on every run and a failure replays. A persistent
database would reject the second run's insert under a unique constraint, though, so the one value
that must not repeat is composed from `spec.nonce`, which changes with each run and each retry.
`format` is how values meet in a string: the language has no `+` and no interpolation, and a
hole with no value, or a value no hole uses, is an error.

## Share steps as commands

More than one test needs a signed-up account, so move those steps into a `command`. A command
under `spec/commands/` resolves by name from any file in the suite, with no import:

```text {% title="spec/commands/accounts.spec" %}
use http
use sample
use spec
use str

command sign_up {
	let who = sample.person
	let handle = format "${name}-${nonce}" {
		name: who.username
		nonce: spec.nonce
	}
	let profile = http.post "/accounts" form {
		email: who.email
		name: who.full_name
		username: handle
	}
	return { name: who.full_name, handle: handle, page: profile }
}
```

```text {% title="spec/profile.spec" %}
use html

test "a new account starts with no events" {
	given {
		let account = sign_up
	}
	then {
		expect account.page.status 200
		expect html.text account.page.text "No events yet"
	}
}
```

A command with no parameters is called by its bare name, and it runs on every call, so two
calls sign up two people. Its body resolves names against the `use` lines of the file that
declared it, so its `http.post` works from a file that never imports `http`.

## Grant permissions by name

The admin API needs a token. Keeping it out of the file is the point of `env.get`, which reads
one variable, and only one you granted by name:

```text {% title="spec/admin.spec" %}
use env
use http

test "the admin API lists accounts for a valid token" {
	given {
		let account = sign_up
		let token = env.get "ADMIN_TOKEN"
	}
	when {
		let response = http.get "/api/accounts" bearer token
	}
	then {
		expect response.status 200
		expect response.json.accounts contains account.handle
	}
}

test "the admin API refuses a request without a token" {
	when {
		let response = http.get "/api/accounts"
	}
	then {
		expect response.status 401
	}
}
```

```bash
ADMIN_TOKEN=… npx spec run spec --allow-net=localhost:8787 --allow-env=ADMIN_TOKEN
```

Without `--allow-env`, the first test fails with a denial naming the flag and the rest of the
suite runs. Every family works the same way: `--allow-run=node,git` spawns named executables,
`--allow-db=web` queries one configured connection, `--allow-host-fs=./db` reaches files
outside the workspace, and `--allow-plugins=name` launches a plugin the project declares. A bare flag
grants the whole family, and repeated scoped flags add up.

Reciting the line on every run gets old, so the suite can declare it:

```json {% title="spec/config.jsonc" %}
{
	"bases": {
		"web": { "env": "APP_BASE_URL", "default": "http://localhost:8787" }
	},
	"permissions": {
		"allow": [
			["net", "localhost:8787"],
			["env", "ADMIN_TOKEN"]
		]
	}
}
```

A `[family, ...scopes]` tuple is a scoped grant and a bare string grants the family. The
declaration is inert until a run adds `--allow-config`, and the denials point at that flag
until then, so cloning a repository never grants its suite anything. Flags passed beside
`--allow-config` only add to what the file declares.

## Run it in CI

The exit code is the contract: `0` when everything passed, `1` when a test failed, and `2` for
a usage or load error such as a parse error. A CI job starts the app, waits for it, and runs
the suite:

```yaml {% title=".github/workflows/spec.yml" %}
name: spec
on: [push]

jobs:
    spec:
        runs-on: ubuntu-latest
        env:
            ADMIN_TOKEN: ${{ secrets.ADMIN_TOKEN }}
        steps:
            - uses: actions/checkout@v4
            - uses: oven-sh/setup-bun@v2
            - run: npm ci
            - run: npm run dev &
            - timeout-minutes: 1
              run: until curl -sf localhost:8787 > /dev/null; do sleep 1; done
            - run: npx spec run spec --allow-config --retries=1 --artifacts=artifacts
            - if: failure()
              uses: actions/upload-artifact@v4
              with:
                  name: spec-artifacts
                  path: artifacts
```

`http` is an action, and an action can't be retried inside `eventually`, so the wait for the
server stays in the shell. `--retries=1` gives a failing test one more attempt in a fresh
workspace with a new `spec.nonce`; a test that passes only on the retry is reported as flaky
rather than hidden. `--artifacts` writes the markup an `html` assertion read when it fails, and
the last step keeps it.

The same suite checks a preview deployment. Point the base at it and grant its host, which
adds to what the config declares:

```bash
APP_BASE_URL=https://preview.example.com \
	npx spec run spec --allow-config --allow-net=preview.example.com
```

Tests run one at a time by default. `--concurrency=4` runs four at once and still reports in
source order. That is safe here because every account a test creates is named from its own
sampled person plus `spec.nonce`, so no two tests write the same row. A nightly
job can add `--seed=random` to draw different sample data and catch a test that only passes
for one particular person; the header prints the seed, and `--seed=<seed>` replays the run.

## Where to go next

- [Test Workers apps](/docs/operations-and-testing/testing): the Vitest side of the suite,
  from a request through the real router to in-memory bindings.
- [Generate believable test data](/docs/operations-and-testing/test-data): the seeded
  generation `sample` draws from, used in TypeScript tests.
- [Build a JSON API with problem details](/docs/http-apis/json-apis): the error bodies the
  API test asserts on.
- [Publish calendar feeds](/docs/content-and-feeds/calendar-feeds): the `.ics` feed the first
  spec checks.
