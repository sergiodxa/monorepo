# @sdxc/catch-response-middleware

Router middleware that turns a thrown `Response` into the request's response.

## Overview

`remix/router` looks only at the value a middleware or request handler _returns_. Its middleware runner checks `response instanceof Response` on the returned value, and the router has no catch of its own, so a thrown `Response` escapes `router.fetch()` as a rejected promise and the runtime reports it as a 500.

A middleware, though, receives `next()` as a promise it can `try`/`catch`, and it may return any `Response` it likes. That is all it takes to recover a thrown one.

The payoff is the React Router idiom: `throw redirect(to)` from anywhere. A helper can end the request without being handed the request context and without the caller having to check its return value:

```typescript
// app/http/current-user.ts
export function currentUser() {
	let user = getViewer();
	if (!user) throw redirect("/login", { status: redirect.Status.SeeOther });
	return user;
}
```

Every caller — a handler, or a helper five frames deeper — can now write `let user = currentUser()` and get a typed, non-nullable user or a redirect, with no `if` and no plumbing.

## Usage

Install it on the router's global middleware chain:

```typescript
import { catchResponse } from "@sdxc/catch-response-middleware";
import { createRouter } from "remix/router";

let router = createRouter({
	middleware: [session(cookie, storage), catchResponse()],
});

router.get("/dashboard", () => {
	let user = currentUser(); // may throw redirect("/login")
	return render(<Dashboard user={user} />);
});
```

## API

### `catchResponse(): Middleware`

Creates the middleware. It calls `next()` and returns the downstream response unchanged. If `next()` rejects:

- with a `Response`, that response is returned as the request's response;
- with anything else, the value is re-thrown untouched.

**Returns:**

- A `Middleware` for a router's, controller's, or route's `middleware` chain.

It adds nothing to the request context and takes no options.

## Ordering

**This is the one thing to get right.** Install `catchResponse()` _below_ every middleware that needs to observe the response.

A throw unwinds the chain, so every middleware between the throw site and the catch never resumes after its own `next()` — whatever it had queued to do to the response is skipped. Only the middleware installed _above_ `catchResponse()` sees the response it recovers.

Correct — the session's `Set-Cookie` lands on the thrown redirect:

```typescript
createRouter({ middleware: [session(cookie, storage), catchResponse()] });
```

Wrong — the throw unwinds past the session middleware's commit step, so a session written before the throw is silently lost:

```typescript
createRouter({ middleware: [catchResponse(), session(cookie, storage)] });
```

The same reasoning applies to anything that decorates or measures the response after `next()` — logging, server timing, compression, CORS headers, `headRequests()`. All of them belong above `catchResponse()`.

## Tips

1. **Non-`Response` errors are re-thrown untouched.** This middleware is not an error boundary. A `TypeError` from a handler still reaches the runtime with its stack intact, so error reporting and the router's own default behaviour are unaffected. Pair it with a separate error-handling middleware if you also want a rendered 500 page.

2. **Install it once, high in the chain.** It is idempotent and cheap, but a second copy lower down would catch throws before the middleware between them can react. One instance at the boundary you want is enough.

3. **Return when you can, throw when you cannot.** A handler that already holds the response should return it: returning keeps the plain control flow and needs no middleware at all. Throwing earns its keep when the decision is made somewhere that cannot return a `Response` to the router — a nested helper, a validator, an auth guard.

4. **`throw` gives you non-nullable return types.** A helper typed `(): User` that throws instead of returning `null` removes a null check from every call site, which is most of the ergonomic win.

5. **Route-level and controller-level chains work too.** A thrown response is caught by the nearest `catchResponse()` above the throw site, wherever in the chain that is — but scoping it to one route means throws from another route's helpers stay uncaught.

## Related Packages

- [`@sdxc/response`](../response/README.md) - The `redirect()`, `forbidden()`, `notFound()` and other helpers whose results are worth throwing
- [`@sdxc/location`](../location/README.md) - Builds the path a `redirect()` points at
- [`@sdxc/http`](../http/README.md) - Ships `headRequests()`, one of the response-observing middleware that belongs above this one
