---
title: Your first handler
description: Three packages composed into a request handler that never throws, and what each line of it demonstrates.
section:
    title: Getting started
    order: 1
order: 3
lastUpdated: 2026-09-21
---

Here is a handler that accepts a markdown document, validates its frontmatter, and answers with
either the frontmatter or the line the document went wrong on. It uses three packages and has
no `try` in it.

```bash
npm add @sdxc/markdown @sdxc/response @sdxc/result
```

```typescript
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

**`Markdown.parse` returns a `Result`.** It does not throw on malformed input and it does not
return `null`. `isFailure` narrows the union, so the compiler will not let you reach
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
[`@sdxc/response`](/api/response): each writes its status, its status text and its
JSON content type, and merges an `ok` field into the body so a client has one field to branch
on.

## Running it

The handler is a plain object with a `fetch` method, which is what a Cloudflare Worker, Deno,
Bun and Node's own server all accept. Nothing in it is framework-specific, and nothing in it is
platform-specific either.

## Where to go next

- [`Result` everywhere](/docs/conventions/result-everywhere) — the shape, and how to work with
  it without writing `isFailure` on every line.
- [Subpath exports](/docs/conventions/subpath-exports) — why some of these imports have a
  second segment.
