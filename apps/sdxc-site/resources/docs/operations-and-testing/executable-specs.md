---
title: Write executable specs
description: Describe your running app's behavior in .spec files, run them against a dev server with named grants, and gate CI on them.
section:
    title: Operations & testing
    order: 9
order: 5
lastUpdated: 2026-10-25
outcomes:
    - "How to describe your running app's behavior in `.spec` files"
    - "How to run specs against a dev server with named grants"
    - "How to gate CI on your executable specs"
---

A Vitest suite checks your code from the inside. An executable spec checks the running app from
the outside, the way a visitor or an API client meets it: a URL, a request, a response.
[`@sdxc/spec`](/api/spec) reads `.spec` files written in a small language of setup, action and
expectation, with no branches, loops or operators, so a spec reads the same to the person who
owns the behavior as to the one who wrote the code. Each test runs in a fresh temporary
workspace, and every privileged act, from reaching the network to reading an environment
variable, needs a grant you name on the command line.

This guide writes a suite for an events app served by its dev server, generates the input it
posts, grants exactly what the suite touches, and runs it in CI. The unit and integration side
lives in [Test Workers apps](/docs/operations-and-testing/testing).

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
deployment or CI by changing one variable.

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
		expect html.element page.text link "Remix meetup"
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

Every `http` verb returns `{ status, ok, headers, text, json }`, and an error status is an
ordinary value to assert on. The `html` namespace reads a page's markup with no browser, and
`element` finds an element by role and accessible name; a name that matches twice is an error
listing both.

## Run it, and read the denial

Run the suite with no flags first:

```bash
npx spec run spec
```

```text
✗ Permission denied: net (2 tests)

  Re-run with an appropriate permission, for example:
  > spec run --allow-net
```

Nothing was sent. Reaching the network is a privilege, and the runner refuses it before the
request is built. Grant exactly the host and port the base resolves to:

```bash
npx spec run spec --allow-net=localhost:8787
```

The run's header names the seed and run id that replay it, and the address each base resolved
to, so a run says which app it reached.

## Share a sign-up with generated input

A sign-up needs a person to sign up, and more than one test needs a signed-up account. Put the
steps in a `command` under `spec/commands/`, which resolves by name from any file in the suite,
and let `sample` draw a believable person:

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

`form` sends the object as `application/x-www-form-urlencoded`, and `http` follows the app's
`303` to the new profile, checking every hop against the grant. A command runs on every call,
so two calls sign up two people.

A test's `sample` draws follow its identity, so the same test posts the same person on every
run and a failure replays. The one value that must not repeat across runs, the username, is
composed from `spec.nonce`, which changes with each run and each retry. `format` is how values
meet in a string, since the language has no `+` and no interpolation.

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
```

```bash
ADMIN_TOKEN=… npx spec run spec --allow-net=localhost:8787 --allow-env=ADMIN_TOKEN
```

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

> [!WARNING]
> The declaration is inert until a run adds `--allow-config`, so cloning a repository never grants
> its suite anything. Flags passed beside `--allow-config` only add to what the file declares.

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

## Where to go next

- [Test Workers apps](/docs/operations-and-testing/testing) — the Vitest side of the suite,
  from a request through the real router to in-memory bindings.
- [Generate believable test data](/docs/operations-and-testing/test-data) — the seeded
  generation `sample` draws from, used in TypeScript tests.
- [`@sdxc/spec`](/api/spec) — every capability and permission flag.
