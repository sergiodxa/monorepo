---
title: Result everywhere
description: Every fallible entry point answers with a value instead of throwing, and what that buys you at the call site.
section:
  title: Conventions
  order: 2
order: 1
lastUpdated: 2026-09-21
---

A function in this collection that can fail returns a
[`Result`](/api/result) rather than throwing. The type is a discriminated union:

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

The compiler will not let you read `data` before you have handled the failure branch, which is
the whole point: a failure is a case in the signature rather than a control-flow surprise.

## Working with one

`isSuccess` and `isFailure` narrow it, and early return is the ordinary shape:

```typescript
import { isFailure } from "@sdxc/result";

let parsed = Markdown.parse(source, { frontmatter: Frontmatter });
if (isFailure(parsed)) return badRequest({ line: parsed.error.position?.start.line });

// parsed.data is typed from here on
```

`match` handles both branches in one expression when there is no early exit to take:

```typescript
import { match } from "@sdxc/result";

let message = match(await fetchUser(id), {
	success: (user) => `Hello, ${user.name}!`,
	failure: (error) => `Error: ${error.message}`,
});
```

`unwrap` takes the value and throws on a failure, optionally through a fallback. It is the
escape hatch, and it belongs where a failure genuinely is a programming error — a test, a
startup check — rather than in a request path.

```typescript
import { unwrap } from "@sdxc/result";

let tag = unwrap(await etag(body));
let port = unwrap(parsePort(input), () => 3000);
```

## Crossing the boundary

Code outside the collection throws. `wrap` turns that into a `Result` so the rest of a function
keeps one shape:

```typescript
import { isSuccess, wrap } from "@sdxc/result";

let parsed = wrap(() => JSON.parse(input));
if (isSuccess(parsed)) use(parsed.data);
```

`partition` splits a batch into what succeeded and what did not, which is what you want when
one failure should not cost you the other nine results:

```typescript
import { partition } from "@sdxc/result";

let [responses, errors] = partition(await Promise.all(urls.map((url) => wrap(() => fetch(url)))));
```

## Errors carry position

A parse failure names where it happened. A `Markdown` error carries a `position` with the line
and column it stopped at; a `YAML` one carries the line, and says so in its message. Either way
an error points at the input rather than describing it. Where an error wraps another one, the
original is kept as its `cause`, so a caller that recognizes a specific failure can look for it
without losing everything else.

## What still throws

Nothing throws _past_ you from a fallible entry point, but a programming error still throws: a
function called with an argument its signature forbids, or a visitor of your own that throws
inside a walk. In that last case the walk catches it, attaches the position of the node it was
standing on, and hands it back on the failure branch — so even that arrives as a value.
