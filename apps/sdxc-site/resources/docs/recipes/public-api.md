---
title: Build a public JSON API
description: A JSON API other developers call with a bearer token, answering failures as problems, safe to retry, described by OpenAPI and shipped with a typed client.
section:
    title: Recipes
    order: 1.7
order: 3
lastUpdated: 2026-10-25
outcomes:
    - "How to build a public JSON API from the HTTP API and identity guides, in order"
    - "Where the caller's identity meets the rate limit and the idempotency scope"
    - "How to check that authentication runs before every other guard"
---

At the end of this recipe you have a books API that developers outside your app call with a
bearer token: every failure is an RFC 9457 problem, every create is safe to retry, the
reference is an OpenAPI document built from the same schemas, and callers get a typed client.
Each linked guide lists the packages it installs; the code on this page adds:

```bash
npm add @sdxc/result remix
```

## Serve the endpoints

Every later step extends the resource, its problem catalog and its rate limit, so build them
first with [Build a JSON API with problem details](/docs/http-apis/json-apis).

## Authenticate callers

A public API needs to know who calls it before it can budget or scope anything. Verify each
bearer token with the `authenticate` function from
[Verify on the other side](/docs/identity-and-security/json-web-tokens#verify-on-the-other-side),
with your API's URL as the `audience`, and add an `unauthorized` entry (status `401`) to the
problem catalog. Then publish the verified token as `ctx.caller`, so every later guard reads it:

```typescript {% title="app/http/middleware/authenticate-caller.ts" %}
import type { Middleware } from "remix/router";

import type { ServiceToken } from "~/app/services/auth/service-token";

import { isFailure } from "@sdxc/result";
import { createContextKey } from "remix/router";

import { authenticate } from "~/app/services/auth/authenticate";
import problems from "~/config/problems";

export const Caller = createContextKey<ServiceToken>();

declare module "remix/router" {
	interface RequestContext {
		caller: ServiceToken;
	}
}

export const authenticateCaller: Middleware = async (ctx, next) => {
	let token = await authenticate(ctx.request);
	if (isFailure(token)) {
		let headers = { "WWW-Authenticate": 'Bearer error="invalid_token"' };
		return problems.unauthorized({}, { headers });
	}

	ctx.set(Caller, token.data, { property: "caller" });
	return next();
};
```

Make each book route's guards `[authenticateCaller, apiRateLimit()]`, with the limiter from
[Rate limit the API](/docs/http-apis/json-apis#rate-limit-the-api) keyed on
`ctx.caller.subject`, so each caller spends its own budget. When your callers hold keys you
issue rather than tokens, [Give your users API keys](/docs/recipes/api-keys) publishes
`ctx.apiKey` in place of this step.

> [!NOTE]
> Keep `authenticateCaller` first. The limiter's key and the idempotency scope both read the
> caller, which exists only once authentication has published it.

## Make writes safe to retry

A caller across the internet retries timeouts and edits stale copies. Follow
[Idempotent writes and JSON Merge Patch](/docs/http-apis/safe-writes), scoping the keys on the
caller: `` `caller:${ctx.caller.subject}` ``.

## Publish the reference

Developers read the contract before they call it. Follow
[Describe your API with OpenAPI](/docs/http-apis/openapi), declaring the `bearer()` scheme, and
map its route without guards, so anyone can read it.

## Ship a typed client

Follow [Write a typed API client](/docs/http-apis/api-clients): the catalog and schemas move
into a contract both sides import, and callers get a client that attaches the token, sends
idempotency keys and turns problems into typed failures.

## Test the guards together

A request without a token is refused before the limiter counts it, as a problem from your
catalog:

```typescript {% title="app/initializers/router.test.ts" %}
import { expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";

test("a request without a token answers 401 before the rate limit", async () => {
	let response = await createWebRouter().fetch(
		"https://books.example.com/api/books",
	);

	expect(response.status).toBe(401);
	expect(response.headers.get("WWW-Authenticate")).toContain("invalid_token");
	expect(response.headers.get("RateLimit-Policy")).toBeNull();
	expect(await response.json()).toMatchObject({
		type: "https://books.example.com/docs/errors/unauthorized",
	});
});
```

## Where to go next

- [Decide who can do what](/docs/identity-and-security/authorization) — decide what each caller's
  scopes let it do, beyond being signed in.
- [Send webhooks of your own](/docs/identity-and-security/webhooks#send-webhooks-of-your-own)
  — tell callers when a book changes instead of having them poll.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — purge expired
  idempotency records on a schedule.
