---
title: Give your users API keys
description: Issue API keys your database keeps only as digests, check the key on every API request, and give each key its own rate limit.
section:
    title: Recipes
    order: 1.7
order: 18
lastUpdated: 2026-10-25
outcomes:
    - "What guides build API keys, and in what order to follow them"
    - "How to check a key and publish it as `ctx.apiKey` for every later guard"
    - "Why the key check runs before the rate limit"
---

By the end of this recipe your users create API keys, see each one once, and call your API with
it as a bearer token. The database keeps only each key's digest, a request is matched to its key
before anything else runs, and every key spends its own rate-limit budget.

```bash
npm add @sdxc/crypto @sdxc/result remix
```

## Issue a key and keep its digest

Mint the key with `randomToken` and store only its SHA-256 digest, as
[Mint secrets with randomToken](/docs/conventions/identifiers-and-secrets#mint-secrets-with-randomtoken)
does for an invitation, with a prefix such as `sk` so a leaked key is recognizable. Show the key
once, on the page that created it.

## Check the key on every request

Build the API and its problem catalog with
[Build a JSON API with problem details](/docs/http-apis/json-apis), adding an `unauthorized`
entry (`status: 401`). Then match the bearer token to a key by its digest and publish the key,
so every later guard reads it:

```typescript {% title="app/http/middleware/authenticate-api-key.ts" %}
import type { Middleware } from "remix/router";

import type { ApiKey } from "~/app/models/api-keys";

import { Hex, sha256 } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { createContextKey } from "remix/router";

import { ApiKeys } from "~/app/models/api-keys";
import problems from "~/config/problems";

export const CurrentApiKey = createContextKey<ApiKey>();

declare module "remix/router" {
	interface RequestContext {
		apiKey: ApiKey;
	}
}

export const authenticateApiKey: Middleware = async (ctx, next) => {
	let header = ctx.request.headers.get("Authorization") ?? "";
	let token = header.startsWith("Bearer ") ? header.slice(7) : "";
	let digest = token === "" ? null : await sha256(token);
	let apiKey =
		digest === null || isFailure(digest)
			? null
			: await ApiKeys.findByTokenHash(ctx.db, Hex.encode(digest.data));
	if (apiKey === null) {
		let headers = { "WWW-Authenticate": 'Bearer error="invalid_token"' };
		return problems.unauthorized({}, { headers });
	}

	ctx.set(CurrentApiKey, apiKey, { property: "apiKey" });
	return next();
};
```

`ApiKeys` is your own model over the keys table, and `ApiKey` its row, with at least an `id`.

## Give each key its own budget

Add the limiter from [Rate limit the API](/docs/http-apis/json-apis#rate-limit-the-api), keyed
on the key rather than the address: `` key: (ctx) => `api-key:${ctx.apiKey.id}` ``. Then make
each API route's guards `[authenticateApiKey, apiRateLimit()]`.

> [!NOTE]
> Keep `authenticateApiKey` first. The limiter's key reads `ctx.apiKey`, which exists only once the
> key has been checked.

## Test it

Test each stage as its guide does:
[Test the endpoints](/docs/http-apis/json-apis#test-the-endpoints) sends requests through the
router with the limiter's binding in place; add one without a key, which answers `401` with no
`RateLimit-Policy` header.

## Where to go next

- [Idempotent writes and JSON Merge Patch](/docs/http-apis/safe-writes) — scope idempotency
  keys on `ctx.apiKey.id`, so retries are safe per key.
- [Decide who can do what](/docs/identity-and-security/authorization) — give each key scopes
  beyond being valid.
- [Build a public JSON API](/docs/recipes/public-api) — the same API with OpenAPI and a typed
  client.
