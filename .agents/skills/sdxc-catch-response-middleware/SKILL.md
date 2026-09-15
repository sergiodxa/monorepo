---
name: sdxc-catch-response-middleware
description: "@sdxc/catch-response-middleware is a one-export remix router middleware, `catchResponse()`, turning a `Response` thrown anywhere below it into the request's response. Use when `throw redirect(to)` from a helper surfaces as a 500, when a guard should end a request without every caller checking a return value, or when ordering the catch against session, logging and timing middleware."
---

# @sdxc/catch-response-middleware

`catchResponse()` is what makes `throw redirect(to)` work at any call depth: a helper can end the request without being handed the request context, and without every caller checking a return value. The router itself inspects only the value a middleware or handler returns and has no catch of its own, so without this a thrown `Response` escapes `router.fetch()` as a rejected promise and surfaces as a 500. It goes on a `remix` v3 router's middleware chain, takes no options, and adds nothing to the request context.

Full API, options and examples: [packages/catch-response-middleware/README.md](packages/catch-response-middleware/README.md)

## When to reach for it

- A helper typed `(): User` should redirect a signed-out request instead of returning `null` for every call site to check.
- A thrown redirect or `429` is reaching the runtime as a 500.
- A `Set-Cookie` from the session middleware is being lost on a thrown redirect, and the chain order needs deciding.
- Authorization helpers from another package signal their decision by throwing a `Response`.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/catch-response-middleware": "workspace:*" } }
```

```ts
import { catchResponse } from "@sdxc/catch-response-middleware";
import { redirect } from "remix/response/redirect";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [catchResponse()] });

router.get("/dashboard", () => {
	throw redirect("/login", { status: 303 });
});
```

## Suggestions

- Install one instance high in the chain but *below* every middleware that reads or decorates the response — logging, server timing, compression, CORS headers, session commits. A throw unwinds the chain, so a middleware between the throw site and the catch never resumes after its own `next()`, and only middleware above the catch sees the recovered response.
- Scoping it to a single route works — the nearest instance above the throw site catches — but leaves throws from every other route uncaught.
- It is not an error boundary: anything that is not a `Response` re-throws unchanged, so a `TypeError` still reaches the runtime with its stack intact. A response it does catch is returned as the same instance, with its status and headers untouched.

## Related

- `@sdxc/auth` — its authorization helpers signal a signed-out request by throwing a `Response`; skill `sdxc-auth`
- `@sdxc/response` — the response helpers commonly thrown below it; skill `sdxc-response`
