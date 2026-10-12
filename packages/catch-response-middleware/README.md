# @sdxc/catch-response-middleware

Router middleware that turns a thrown `Response` into the request's response.

With it installed, `throw redirect(to)` works at any call depth: a helper ends the request without
being handed the request context, and its callers never check a return value.

## Installation

```sh
npm add @sdxc/catch-response-middleware
```

It goes on a `remix/router` middleware chain, so [`remix`](https://www.npmjs.com/package/remix) (v3)
installs alongside it.

## Usage

### Install it on the router

Any `Response` thrown below the middleware answers the request.

```typescript
import { catchResponse } from "@sdxc/catch-response-middleware";
import { redirect } from "remix/response/redirect";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [catchResponse()] });

router.get("/dashboard", () => {
	throw redirect("/login", 303);
});
```

The router itself reads only the `Response` a handler or middleware returns, so a thrown one
rejects `router.fetch()`. This middleware is the try/catch around `next()` that turns it back into
the response.

### Throw from a helper

The throw site can be any number of frames below the handler, so a helper returns the value its
callers want and ends the request otherwise.

```typescript
import { redirect } from "remix/response/redirect";

interface User {
	id: string;
}

function currentUser(request: Request): User {
	let user = readUser(request);
	if (!user) throw redirect("/login", 303);
	return user;
}

router.get("/dashboard", ({ request }) => {
	let user = currentUser(request);
	return Response.json({ id: user.id });
});
```

## API

### `catchResponse(): Middleware`

Returns a middleware for a router's or route's `middleware` chain; it takes no options and adds
nothing to the request context. It returns whatever `next()` resolves to, answers with any
`Response` thrown downstream — by a handler, a helper or another middleware — and re-throws every
other value unchanged, so real errors still reach the runtime.

## Pattern: Order It Below Response-Observing Middleware

A throw unwinds the chain, so a middleware between the throw site and `catchResponse()` never
resumes after its own `next()`. Install it below every middleware that reads or decorates the
response — sessions, logging, timing, CORS — so they see the recovered response.

```typescript
import { catchResponse } from "@sdxc/catch-response-middleware";
import { createCookie } from "remix/cookie";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { createMemorySessionStorage } from "remix/session-storage/memory";

let cookie = createCookie("session", { secrets: ["s3cret"] });
let storage = createMemorySessionStorage();

let router = createRouter({
	middleware: [session(cookie, storage), catchResponse()],
});
```

Here the session's `Set-Cookie` lands on a thrown redirect. With the two reversed, the throw skips
the session commit and the redirect goes out without it.

## Pattern: Guard A Route From Middleware

A route-level middleware throws to stop the request before the handler runs; the global
`catchResponse()` above it turns the throw into the response.

```typescript
import type { Middleware } from "remix/router";

import { catchResponse } from "@sdxc/catch-response-middleware";
import { redirect } from "remix/response/redirect";
import { createRouter } from "remix/router";

let requireUser: Middleware = ({ request }, next) => {
	if (!request.headers.has("Authorization")) throw redirect("/login", 303);
	return next();
};

let router = createRouter({ middleware: [catchResponse()] });

router.get("/settings", {
	middleware: [requireUser],
	handler: () => new Response("Your settings"),
});
```

## Pattern: Throw Error Responses From Data Helpers

Any status works, not only redirects. A loader helper throws a 404 or 403 and the handler only
deals with the record it got back. [`@sdxc/response`](https://www.npmjs.com/package/@sdxc/response)
builds those JSON responses.

```typescript
import { catchResponse } from "@sdxc/catch-response-middleware";
import { forbidden, notFound } from "@sdxc/response";
import { createRouter } from "remix/router";

interface Post {
	id: string;
	ownerId: string;
	title: string;
}

async function requireOwnPost(id: string, userId: string): Promise<Post> {
	let post = await findPost(id);
	if (!post) throw notFound({ error: "Post not found" });
	if (post.ownerId !== userId) throw forbidden({ error: "Not your post" });
	return post;
}

let router = createRouter({ middleware: [catchResponse()] });

router.get("/posts/:id", async ({ params, request }) => {
	let post = await requireOwnPost(params.id, readUserId(request));
	return Response.json(post);
});
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/catch-response-middleware": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
