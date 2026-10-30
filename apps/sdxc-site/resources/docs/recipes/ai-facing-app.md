---
title: Build an app agents can use
description: A JSON API with problem details and an OpenAPI document, MCP tools over the same data, and agents that are authenticated, budgeted and logged.
section:
    title: Recipes
    order: 1.7
order: 4
lastUpdated: 2026-10-25
outcomes:
    - "How to give agents a JSON API, an OpenAPI document and MCP tools over one app"
    - "How to authenticate an agent, scope it and budget it by who it is"
    - "Where each agent's calls land in the invocation's wide log event"
---

An agent works best with an app that answers in data it can act on. At the end of this recipe
your app serves a JSON API whose failures are problem documents, describes it with OpenAPI,
exposes tools and resources over MCP, and authenticates, rate limits and logs every agent that
calls either one. Each linked guide lists the packages it installs; the code on this page adds:

```bash
npm add @sdxc/cache @sdxc/get-client-ip @sdxc/http-signatures @sdxc/logger @sdxc/rate-limit \
	@sdxc/result
```

## Serve a JSON API an agent can recover from

Every failure answers as a problem with a stable `type` and a pointer to the field at fault,
which lets an agent fix its request and try again. Follow
[Build a JSON API with problem details](/docs/http-apis/json-apis), then
[Describe your API with OpenAPI](/docs/http-apis/openapi), so an agent learns every operation
from the schemas the API already validates with before it calls one.

## Expose tools and resources over MCP

An MCP client calls tools and reads resources without writing HTTP requests. The handlers read
the same models the API controllers do, so the two surfaces agree. Follow
[Expose your app over MCP](/docs/operations-and-testing/mcp-server).

## Authenticate the agent and scope what it may do

An agent acts for a person, with a bearer token your app issued. Verify it as in
[Verify on the other side](/docs/identity-and-security/json-web-tokens#verify-on-the-other-side),
inside the `requireToken` middleware that
[Scope an agent](/docs/identity-and-security/authorization#scope-an-agent) puts on the MCP
route, which caps every check at the token's scope. Include the token's holder in the
`cachedSearch` key too, so one agent never reads another's cached answer.

## Budget each agent by who it is

The API's limiter keys on the network, which lumps every agent behind one cloud provider
together. A crawler that signs with
[Web Bot Auth](/docs/identity-and-security/http-message-signatures#identify-your-bot-with-web-bot-auth)
names its own origin, so key a signed request on that origin and fall back to the network:

```typescript {% title="app/http/middleware/agent-rate-limit.ts" %}
import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { getClientIP } from "@sdxc/get-client-ip";
import { verifyWebBotAuth } from "@sdxc/http-signatures/web-bot-auth";
import { currentLog } from "@sdxc/logger";
import { addressKey, CloudflareAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";
import { isFailure } from "@sdxc/result";
import { env, waitUntil } from "cloudflare:workers";

import problems from "~/config/problems";

export function agentRateLimit() {
	let limit = { limit: 100, window: "1 minute" } as const;
	return rateLimit({
		adapter: new CloudflareAdapter(env.API_RATE_LIMITER, limit),
		prefix: "agent",
		key: async (ctx) => {
			let cache = new WorkerKVCache(env.CACHE, { waitUntil });
			let bot = await verifyWebBotAuth(ctx.request, { cache });
			if (isFailure(bot)) return addressKey(getClientIP(ctx.request));
			currentLog()?.set({ agent: { id: bot.data.agent } });
			return bot.data.agent;
		},
		onLimit: () =>
			problems.rateLimited({ detail: "Wait for the time in Retry-After." }),
	});
}
```

Use `agentRateLimit()` in place of `apiRateLimit()` as the guards of the API and OpenAPI
routes, and put it before `requireToken` in the MCP route's guards.

## Record what every agent did

Follow [Logs, traces and timings](/docs/operations-and-testing/observability), with `log(logger)`
and `trace()` at the top of the router. The limiter's `rate_limit` fields and the agent's
`agent.id` then land on the invocation's one log event, beside its route, status and duration.

> [!NOTE]
> Keep this order: `log(logger)` first, so everything after it writes into one record, and the
> limiter before `requireToken`, so an agent over its budget is refused before its token costs a
> verification.

## Test that both surfaces share the budget

Send unsigned requests through the router, with `API_RATE_LIMITER` and `CACHE` in the
`cloudflare:workers` stand-in the JSON API and MCP guides set up. Both surfaces carry the
agent budget, and the MCP route refuses a request without a token:

```typescript {% title="app/initializers/router.test.ts" %}
import { expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";

const POLICY = '"default";q=100;w=60';

test("both surfaces answer under the agent budget", async () => {
	let router = createWebRouter();
	let document = await router.fetch("https://books.example.com/api/openapi.json");
	expect(document.status).toBe(200);
	expect(document.headers.get("RateLimit-Policy")).toBe(POLICY);
	let mcp = await router.fetch("https://books.example.com/mcp", { method: "POST" });
	expect(mcp.status).toBe(401);
	expect(mcp.headers.get("RateLimit-Policy")).toBe(POLICY);
});
```

## Where to go next

- [Idempotent writes and JSON Merge Patch](/docs/http-apis/safe-writes) — make writes safe
  for an agent that retries after a timeout.
- [Write a typed API client](/docs/http-apis/api-clients) — call the API from your own agent
  with the same catalog.
- [Sign and verify HTTP requests](/docs/identity-and-security/http-message-signatures) — sign
  your own bot's requests and publish its key directory.
