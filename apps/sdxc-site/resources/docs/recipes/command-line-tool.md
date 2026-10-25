---
title: Build a command-line tool
description: A tool people install from npm that reads their configuration file, calls an HTTP API through a typed client, retries the calls that can succeed next time, and is tested without a terminal.
section:
    title: Recipes
    order: 1.7
order: 5
lastUpdated: 2026-10-25
outcomes:
    - "How to put commands, a configuration file and an API client together in one tool"
    - "Where retries go so a flaky call never reaches the person running the tool"
    - "How to test a whole command against a mocked API"
---

At the end of this recipe you have `books`, a command-line tool for an HTTP API: it reads the
user's `books.jsonc`, calls the API through a typed client, retries a call the server could
answer next time, and runs end to end in a test. Each linked guide lists the
packages it installs; the code on this page adds:

```bash
npm add @sdxc/backoff @sdxc/cli @sdxc/result
```

## Declare the commands

Help, usage errors and every handler's types come from the command contract, so it comes first.
Follow [Build a command line](/docs/operations-and-testing/build-a-command-line), and declare a
`show` command with one `id` argument for the steps below.

## Read the user's configuration file

Follow [Read configuration files](/docs/operations-and-testing/configuration-files), reading
`books.jsonc` with a schema of your own settings: here, `origin: s.string()`, the API the tool
talks to. Its middleware hands the settings to every command as `ctx.config`.

## Call the API through a typed client

Follow [Write a typed API client](/docs/http-apis/api-clients), putting the client in
`src/books/` and importing its modules relatively. Every call answers a `Result`, so a handler
only branches on success or failure.

## Retry the calls that can succeed next time

A timeout or a `503` often clears on its own, and a person at a terminal waits through every
attempt, so the `show` handler retries on the short schedule from
[Retry inside one request](/docs/data-and-background-work/retry-with-backoff#retry-inside-one-request),
and only a call that got no answer, a `429` or a `5xx`. It reads the origin from `ctx.config`
and the key from `ctx.env`:

```typescript {% title="src/cli.ts" %}
import { createBackoff } from "@sdxc/backoff";
import { createCLI, failure, success, usage } from "@sdxc/cli";
import { isFailure, retry } from "@sdxc/result";

import { BooksClient } from "./books/client.js";
import { COMMANDS } from "./commands.js";
import { config } from "./middleware/config.js";

const BACKOFF = createBackoff({ base: 200, max: "2 seconds", jitter: "full" });

export const cli = createCLI({
	name: "books",
	version: "1.0.0",
	commands: COMMANDS,
	middleware: [config()],
});

cli.map(COMMANDS.show, async (ctx) => {
	let token = ctx.env.BOOKS_API_KEY;
	if (token === undefined) return usage("Set BOOKS_API_KEY to your API key");

	let client = new BooksClient(token, new URL(ctx.config.origin));
	let book = await retry(() => client.book(ctx.arguments.id), {
		times: 4,
		delay: (attempt) => BACKOFF.delay(attempt),
		when: (error) =>
			error.status === null || error.status === 429 || error.status >= 500,
	});
	if (isFailure(book)) {
		return failure(new Error("Could not read the book", { cause: book.error }));
	}

	ctx.stdout(`${JSON.stringify(book.data, null, 2)}\n`);
	return success();
});
```

## Test the command

`invoke` from `@sdxc/cli/test` runs `show` with the folder and environment you give it, so a
test writes a `books.jsonc` into a temporary folder, sets `BOOKS_API_KEY`, and has MSW answer a
`503` once before the book: one run then checks the configuration, the client and the retry
together. [Test a command](/docs/operations-and-testing/build-a-command-line#test-a-command)
shows `invoke`, and [Write a typed API client](/docs/http-apis/api-clients) mocks the API with
MSW.

## Where to go next

- [Use the packages outside Remix](/docs/getting-started/outside-remix) — which packages need
  Remix installed and which run on their own.
- [Import and export CSV](/docs/data-and-background-work/csv) — a command that reads or writes a
  file the user hands it.
- [`@sdxc/cli`](/api/cli) — every flag option, prompt kind and context member.
