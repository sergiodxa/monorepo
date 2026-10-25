---
title: Your first handler
description: Three packages composed into a request handler that never throws, and what each line of it demonstrates.
section:
    title: Packages à la carte
    order: 1.5
order: 2
lastUpdated: 2026-10-19
outcomes:
    - "How three packages compose into a request handler with no `try` in it"
    - "How a `Result` makes you handle a parse failure"
    - "How a parse error carries the line it happened on"
---

Here is a handler that accepts a markdown document, validates its frontmatter, and answers with
either the frontmatter or the line the document went wrong on. It uses three packages and has
no `try` in it. You end with a Worker you can deploy as is, a test that proves both branches,
and a look at the conventions every other package shares.

```bash
npm add @sdxc/markdown @sdxc/response @sdxc/result remix
```

```typescript {% title="src/worker.ts" %}
import { Markdown } from "@sdxc/markdown";
import { badRequest, methodNotAllowed, ok } from "@sdxc/response";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";

let Frontmatter = s.object({
	title: s.string(),
	tags: s.optional(s.array(s.string())),
});

export default {
	async fetch(request: Request): Promise<Response> {
		if (request.method !== "POST")
			return methodNotAllowed({ error: "Send a POST" });

		let parsed = Markdown.parse(await request.text(), {
			frontmatter: Frontmatter,
		});

		if (isFailure(parsed)) {
			return badRequest({
				error: parsed.error.message,
				line: parsed.error.position?.start.line,
			});
		}

		return ok({ frontmatter: parsed.data.frontmatter });
	},
};
```

## What each part is doing

**`Markdown.parse` returns a `Result`.** Malformed input comes back as a failure value you
branch on. `isFailure` narrows the union, so the compiler will not let you reach
`parsed.data` on the branch where there is none. This is the shape every fallible entry point
in the collection has — see [`Result` everywhere](/docs/conventions/result-everywhere).

**The schema is a Standard Schema.** `s.object` here comes from `remix/data-schema`, but the
option accepts any library implementing the same interface, and the parsed frontmatter is typed
from the schema you passed. See
[Standard Schema validation](/docs/conventions/standard-schema-validation).

**The error carries a position.** `parsed.error.position` points at where in the document the
parse gave up, so the response tells the client which line to fix instead of that something,
somewhere, was wrong.

**The response helpers name the status.** `ok`, `badRequest` and `methodNotAllowed` are
[`@sdxc/response`](/api/response): each writes its status and the JSON content type, and
merges an `ok` field into the body so a client has one field to branch
on.

## Run it

The handler is a plain object with a `fetch` method, which is the module shape a Cloudflare
Worker, Deno and Bun all serve. Every line in it is web platform code, so it runs the same on
each of them.

## Test it

The handler is a plain function from a `Request` to a `Response`, so a Vitest test calls its
`fetch` directly, with no server and no platform:

```typescript {% title="src/worker.test.ts" %}
import { expect, test } from "vitest";

import worker from "./worker";

function post(body: string) {
	return worker.fetch(
		new Request("https://example.com/", { method: "POST", body }),
	);
}

test("answers with the validated frontmatter", async () => {
	let response = await post("---\ntitle: Hello\n---\n\n# Hi\n");

	expect(response.status).toBe(200);
	expect(await response.json()).toMatchObject({ frontmatter: { title: "Hello" } });
});

test("names the line a broken document fails on", async () => {
	let response = await post("---\ntitle: [oops\n---\n\n# Hi\n");

	expect(response.status).toBe(400);
	expect(await response.json()).toMatchObject({ line: 2 });
});
```

## Where to go next

- [`Result` everywhere](/docs/conventions/result-everywhere) — the shape, and how to work with
  it without writing `isFailure` on every line.
- [Subpath exports](/docs/conventions/subpath-exports) — why some of these imports have a
  second segment.
- [Use the packages outside Remix](/docs/getting-started/outside-remix) — packages with no
  framework at all, served from a Worker and from Bun.
