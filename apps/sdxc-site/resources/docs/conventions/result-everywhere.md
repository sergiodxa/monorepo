---
title: Result everywhere
description: Every fallible entry point answers with a value instead of throwing, and what that buys you at the call site.
section:
    title: Conventions
    order: 3
order: 1
lastUpdated: 2026-10-25
outcomes:
    - "Why every fallible entry point returns a `Result` instead of throwing"
    - "How to branch on a `Result` and carry it across a boundary"
    - "What still throws and how errors carry their position"
---

A function in this collection that can fail returns a [`Result`](/api/result) rather than
throwing, so a failure is a case in its signature instead of a control-flow surprise. This page
shows how to branch on one, return one from your own code, and turn code that throws into one,
so every handler in your app reads as a straight line of early returns.

```bash
npm add @sdxc/http @sdxc/markdown @sdxc/result @sdxc/validate remix
```

The type is a discriminated union:

```typescript
type Result<T, E extends Error> = Success<T> | Failure<E>;

interface Success<T> {
	status: "success";
	data: T;
}

interface Failure<E extends Error> {
	status: "failure";
	error: E;
}
```

The compiler lets you read `data` only after you have handled the failure branch.

## Branch with an early return

`isSuccess` and `isFailure` narrow a `Result`, and an early return on the failure is the
ordinary shape. [`@sdxc/validate`](/api/validate) answers a submitted form this way:

```tsx {% title="app/http/controllers/teams/new.tsx" %}
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import page from "~/app/http/middleware/page";
import { NewTeamSchema } from "~/app/http/validators/team";
import { NewTeamPage } from "~/resources/views/teams/new";
import routes from "~/routes/web";

export default createController(routes.teams.new, {
	middleware: page,
	actions: {
		index: (ctx) => ctx.render(<NewTeamPage assets={ctx.assets} />),

		action: async (ctx) => {
			let input = await validate(ctx.formData, NewTeamSchema);
			let team = isFailure(input)
				? input
				: await ctx.models.team.create(input.data);
			if (isFailure(team)) {
				let form = (
					<NewTeamPage assets={ctx.assets} issues={team.error.issues} />
				);
				return ctx.render(form, { status: 422 });
			}

			let location = routes.teams.show.href({ id: team.data.id });
			return redirect(location, { status: redirect.Status.SeeOther });
		},
	},
});
```

A model's `create` answers with a `Result` too, so a refused submission and a refused row share
one branch.

`match` handles both branches in one expression when there is no early exit to take:

```typescript
import { match } from "@sdxc/result";

let message = match(await fetchUser(id), {
	success: (user) => `Hello, ${user.name}!`,
	failure: (error) => `Error: ${error.message}`,
});
```

## Return a Result from your own code

A service of yours that can fail answers the same way, with `success` and `failure`, so the
controller calling it keeps one shape all the way down:

```typescript {% title="app/services/articles/import.ts" %}
import { Markdown } from "@sdxc/markdown";
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";
import * as s from "remix/data-schema";

const FRONTMATTER = s.object({ title: s.string(), slug: s.string() });

export function importArticle(
	source: string,
): Result<{ title: string; slug: string; body: string }, Error> {
	let parsed = Markdown.parse(source, { frontmatter: FRONTMATTER });
	if (isFailure(parsed)) return parsed;

	let { title, slug } = parsed.data.frontmatter;
	if (slug.includes("/"))
		return failure(new Error(`Slug "${slug}" contains a slash`));

	return success({ title, slug, body: source });
}
```

A failure from a package passes straight through: `return parsed` hands the caller the same
error, with its position intact.

## Cross the boundary with wrap

Code outside the collection throws. `wrap` turns that into a `Result`, and it awaits a function
that returns a promise, so the rest of a function keeps one shape:

```typescript
import { isSuccess, wrap } from "@sdxc/result";

let parsed = wrap(() => JSON.parse(input));
if (isSuccess(parsed)) use(parsed.data);
```

To call a `Result`-returning function again on a transient failure, wrap it in `retry`;
[Retry on a growing delay](/docs/data-and-background-work/retry-with-backoff) covers it.

## Unwrap where a failure is a bug

`unwrap` takes the value and throws on a failure, or answers through a fallback you pass. It
belongs where a failure genuinely is a programming error, such as a test or a startup check:

```typescript
import { unwrap } from "@sdxc/result";

let tag = unwrap(await etag(body));
let port = unwrap(parsePort(input), () => 3000);
```

> [!WARNING]
> `unwrap` without a fallback rethrows the failure's error. In a request path that turns bad
> input into a 500, so branch with `isFailure` there and keep `unwrap` for tests and startup.

## Errors carry position

A parse failure names where it happened: a `Markdown` error carries a `position` with the line
and column, so a response can tell the client which line to fix. An error that wraps another
keeps the original as its `cause`.

## What still throws

A programming error still throws: a function called with an argument its signature forbids,
such as `retry` with `times: 0`. Every other failure arrives as a value.

## Where to go next

- [Standard Schema validation](/docs/conventions/standard-schema-validation) — the schemas
  behind most of the `Result`s you branch on.
- [Retry on a growing delay](/docs/data-and-background-work/retry-with-backoff) — a backoff
  schedule with a ceiling and jitter for `retry`'s `delay`.
- [`@sdxc/result`](/api/result) — every helper and its signature.
