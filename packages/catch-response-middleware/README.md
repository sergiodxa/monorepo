# @sdxc/catch-response-middleware

Router middleware that turns a thrown `Response` into the request's response.

It is what makes `throw redirect(to)` work at any call depth: a helper can end the request without being handed the request context, and without every caller checking a return value.

## Installation

```bash
npm add @sdxc/catch-response-middleware
```

It goes on a `remix/router` middleware chain, so [`remix`](https://www.npmjs.com/package/remix) (v3) installs alongside it.

## Usage

### Basic Example

Install it on the router's global chain, and any `Response` thrown below it answers the request.

```typescript
import { catchResponse } from "@sdxc/catch-response-middleware";
import { redirect } from "remix/response/redirect";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [catchResponse()] });

router.get("/dashboard", () => {
	throw redirect("/login", { status: 303 });
});
```

Without it the router rejects instead: it inspects only the value a middleware or handler _returns_ and has no catch of its own, so a thrown `Response` escapes `router.fetch()` as a rejected promise and surfaces as a 500. A middleware receives `next()` as a promise it can `try`/`catch`, and may return any `Response` it likes.

### Throwing From A Helper

The throw site does not have to be the handler, which is where the ergonomics come from: a helper typed `(): User` needs no null check at any call site.

```typescript
import { redirect } from "remix/response/redirect";

function currentUser(): User {
	let user = readViewer();
	if (!user) throw redirect("/login", { status: 303 });
	return user;
}

router.get("/dashboard", () => {
	let user = currentUser(); // a User, or a redirect
	return Response.json({ id: user.id });
});
```

## API

### `catchResponse(): Middleware`

Returns a middleware for a router's, controller's, or route's `middleware` chain. It takes no options and adds nothing to the request context.

It awaits `next()` and returns that response untouched — same instance, same status, same headers. When `next()` rejects with a `Response`, that response answers the request, whether it was thrown by the handler, by a helper any number of frames deeper, or by another middleware downstream. Anything else re-throws unchanged, so a `TypeError` still reaches the runtime with its stack intact: this is not an error boundary.

## Pattern: Ordering Against Response-Observing Middleware

Install `catchResponse()` _below_ every middleware that reads or decorates the response — logging, server timing, compression, CORS headers, session commits.

A throw unwinds the chain, so a middleware between the throw site and the catch never resumes after its own `next()`, and whatever it had queued to do to the response is skipped. Only the middleware above `catchResponse()` sees the response it recovers.

```typescript
import { catchResponse } from "@sdxc/catch-response-middleware";
import { createCookie } from "remix/cookie";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { createMemorySessionStorage } from "remix/session-storage/memory";

let cookie = createCookie("session", { secrets: ["s3cret"] });
let storage = createMemorySessionStorage();

// The session's Set-Cookie lands on the thrown redirect.
createRouter({ middleware: [session(cookie, storage), catchResponse()] });

// Reversed, the throw unwinds past the commit and the session is silently lost.
createRouter({ middleware: [catchResponse(), session(cookie, storage)] });
```

One instance, high in the chain, is the usual answer. Scoping it to a single route works — the nearest instance above the throw site catches — but leaves throws from every other route uncaught.

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
