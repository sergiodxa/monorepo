---
title: Client addresses and networks
description: Read the caller's address once per request, key limits on its network, store it as text, admit only your own networks and refuse internal targets.
section:
    title: Identity & security
    order: 6
order: 12
lastUpdated: 2026-10-25
outcomes:
    - "How to read the caller's address once per request and decide what `null` means"
    - "How to key a rate limit on the client's network and admit only your own networks"
    - "How to refuse an internal address someone typed into a URL"
---

An IP address shows up in more places than it looks: the key of a rate limit, a column on a
sign-in record, a field in a log line, the gate in front of an admin page, the host of a webhook
URL someone typed. Each place gets it as text, and text can be `"unknown"`, a comma-joined pair
of headers, an IPv6 address written three different ways, or `0x7f.1`. A key built from that
text counts one client as many, and a check written against it lets an internal address through.

This guide parses the address once, at the edge of your app, and passes a checked value
everywhere after. [`@sdxc/get-client-ip`](/api/get-client-ip) reads the connecting address
Cloudflare vouches for and publishes it as `ctx.ip`. [`@sdxc/ip`](/api/ip) is the value it
holds: an `IP` that knows its canonical spelling, the network it sits in and what the IANA
registries say it is for, plus `IP.Range` for networks.

```bash
npm add @sdxc/get-client-ip @sdxc/http @sdxc/ip @sdxc/logger @sdxc/outbound \
	@sdxc/rate-limit @sdxc/result @sdxc/validate remix
```

## Publish the address once

Add the middleware to the router's global chain. It reads the `CF-Connecting-IP` header
Cloudflare attaches to every request it routes, parses it, and publishes the result as `ctx.ip`
before any route middleware or handler runs.

```tsx {% title="app/initializers/router.tsx" %}
import getClientIP from "@sdxc/get-client-ip/middleware";
import { log } from "@sdxc/logger/middleware";
import { createRouter } from "remix/router";

import defaultHandler from "~/app/http/controllers/default-handler";
import { logger } from "~/app/initializers/logger";

export function createWebRouter() {
	let router = createRouter({
		middleware: [
			log(logger),
			getClientIP(),
			// …then cop(), formData() and a renderer
		],
		defaultHandler,
	});
	// router.map(…) for each route
	return router;
}
```

Importing the middleware module types `ctx.ip` as `IP | null` across your project.

## Decide what `null` means

`ctx.ip` is `null` when something other than Cloudflare's edge served the request (a local dev
server, a test) or the header is not one address. Either way nobody vouched for the caller's
address, so pick the answer per use, by what an unknown caller should get:

- A **budget** shares one bucket across every unknown caller, so it stays finite.
- A **gate** refuses, because admitting an unknown caller is the same as having no gate.
- A **record** stores `null`, so the column says "unknown" rather than a made-up value.

## Key a budget on the client's network

An IPv6 client is normally handed a whole `/64` and rotates through addresses inside it, so a
limit keyed on the full address gives it a fresh budget with every rotation. `addressKey` from
`@sdxc/rate-limit` keys on the network instead: the address itself for IPv4, its `/64` for
IPv6. A `null` address answers `"unknown"`, the one bucket every unidentified caller shares.

```typescript {% title="app/http/middleware/rate-limit.ts" %}
import type { Middleware } from "remix/router";

import { addressKey, KVAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";
import { env } from "cloudflare:workers";

export function clientBudget(prefix: string, limit: number): Middleware {
	return rateLimit({
		adapter: new KVAdapter(env.RATE_LIMITS, { limit, window: "1 minute" }),
		prefix,
		key: (ctx) => addressKey(ctx.ip),
	});
}
```

Every address in one `/64` prints the same network, so `2001:DB8:1:2::7` and
`2001:db8:1:2:0:0:0:9` spend the same budget.

## Pass an `IP`, not a string

A function that takes an `IP` cannot be handed `"unknown"` or a hostname, so the check happens
once, where the value enters. Write your own services against the type:

```typescript {% title="app/services/sign-ins.ts" %}
import type { Database } from "remix/data-table";

import { IP } from "@sdxc/ip";
import { isSuccess } from "@sdxc/result";

import { SignIns } from "~/app/models/sign-ins";

const CLIENT_NETWORK: IP.Prefixes = { v4: 32, v6: 64 };

export async function recordSignIn(db: Database, userId: string, ip: IP | null) {
	await SignIns.create(db, { userId, ip: ip?.toString() ?? null });
}

export async function isNewNetwork(db: Database, userId: string, ip: IP) {
	let last = await SignIns.latest(db, userId);
	if (!last || last.ip === null) return true;

	let stored = IP.parse(last.ip);
	if (!isSuccess(stored)) return true;

	let before = stored.data.network(CLIENT_NETWORK);
	return !before.equals(ip.network(CLIENT_NETWORK));
}
```

`SignIns` is your own model over a table with a text `ip` column. `toString()` writes the
canonical form, so equal addresses store equal strings, and reading it back goes through
`IP.parse`, so a row edited by hand becomes a failure you handle instead of a value you trust.

> [!NOTE]
> Compare two addresses or two networks with `equals`: two `IP`s parsed from the same text are
> two objects, and `===` compares objects by identity.

A handler hands over what the middleware published, and adds the canonical text to the
request's log record:

```typescript {% title="app/http/controllers/sessions/create.ts" %}
await recordSignIn(ctx.db, user.id, ctx.ip);
if (ctx.ip && (await isNewNetwork(ctx.db, user.id, ctx.ip))) {
	ctx.log.set({ sign_in: { new_network: true } });
}
ctx.log.set({ client: { ip: ctx.ip?.toString() ?? null } });
```

> [!WARNING]
> An IP address is personal data in many jurisdictions. Decide how long your logs keep it before
> you add the field.

## Admit only your own networks

An admin area that only staff on the office network or the VPN should reach is a list of
ranges and a membership test. Keep the list as plain strings at module level, and parse inside
the function:

> [!NOTE]
> A Worker that does work in its global scope fails upload validation, so a range parsed at
> module level stops the deploy.

```typescript {% title="app/http/middleware/office-only.ts" %}
import type { Middleware } from "remix/router";

import { forbidden } from "@sdxc/http/response/json";
import { IP } from "@sdxc/ip";
import { isSuccess } from "@sdxc/result";

export const OFFICE_NETWORKS = ["203.0.113.0/24", "2001:db8:42::/48"];

export function isOfficeAddress(ip: IP): boolean {
	return OFFICE_NETWORKS.some((text) => {
		let range = IP.Range.parse(text);
		return isSuccess(range) && range.data.contains(ip);
	});
}

export default function officeOnly(): Middleware {
	return (ctx, next) => {
		if (ctx.ip && isOfficeAddress(ctx.ip)) return next();
		return forbidden({ error: "This page is open to the office network." });
	};
}
```

Pass `[officeOnly()]` as the second argument of the admin routes' `lazy()` in the router, so it
runs after the global chain has published `ctx.ip` and before the admin module loads. A
request with no usable address is refused with the rest. `contains` matches within one IP
version, so list the office's IPv6 prefix too when it has one.

## Refuse an internal address someone typed

A webhook target, an uptime probe or an avatar URL is a host chosen by someone else, and your
Worker will connect to it. `checkUrl` from [`@sdxc/outbound`](/api/outbound) judges it before
anything is stored: it parses the URL, classifies an address literal with `@sdxc/ip`, and
refuses anything that is not on the public internet.

```typescript {% title="app/http/controllers/webhooks/create.ts" %}
import { created, unprocessableEntity } from "@sdxc/http/response/json";
import { checkUrl } from "@sdxc/outbound";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { Webhooks } from "~/app/models/webhooks";
import routes from "~/routes/web";

const WEBHOOK = s.object({ url: s.string() });

export default createAction(routes.webhooks.create, async (ctx) => {
	let body = await validate(ctx.request, WEBHOOK);
	if (isFailure(body)) return unprocessableEntity({ issues: body.error.issues });

	let url = checkUrl(body.data.url);
	if (isFailure(url)) {
		return unprocessableEntity({
			error: url.error.message,
			code: url.error.code,
		});
	}

	let webhook = await Webhooks.save(ctx.db, { url: url.data.href });
	return created({ id: webhook.id });
});
```

The checks run on the parsed URL, so every spelling of `127.0.0.1` (`http://0x7f.1/`,
`http://2130706433/`, `::ffff:127.0.0.1`) is judged as that address. A literal that is not
public fails with `refused-address`, naming its classification (`10.0.0.1 is private`), and
names such as `localhost` or `db.internal` fail with `refused-host`.

> [!WARNING]
> `checkUrl` reads the URL alone. `hooks.example.com` passes it and can still resolve to
> `127.0.0.1`, and a redirect can lead anywhere. Check every address a name resolves to, on every
> hop, in the fetch itself:
> [Fetch URLs a stranger chose](/docs/identity-and-security/fetch-untrusted-urls) covers that.

## Test with the header Cloudflare sends

In a test, no edge sits in front of the router, so `ctx.ip` is `null` until the request carries
`CF-Connecting-IP`. Set the header to drive each branch, and leave it off to drive the unknown
caller:

```typescript {% title="app/http/middleware/office-only.test.ts" %}
import getClientIP from "@sdxc/get-client-ip/middleware";
import { IP } from "@sdxc/ip";
import { isSuccess } from "@sdxc/result";
import { createRouter } from "remix/router";
import { expect, test } from "vitest";

import officeOnly, { OFFICE_NETWORKS } from "./office-only";

function adminRouter() {
	let router = createRouter({ middleware: [getClientIP(), officeOnly()] });
	router.get("/admin", () => new Response("ok"));
	return router;
}

function visit(ip?: string) {
	let headers = new Headers();
	if (ip !== undefined) headers.set("CF-Connecting-IP", ip);
	return adminRouter().fetch(new Request("https://app.test/admin", { headers }));
}

test("an office address reaches the page", async () => {
	expect((await visit("203.0.113.40")).status).toBe(200);
	expect((await visit("2001:DB8:42::7")).status).toBe(200);
});

test("any other caller is refused", async () => {
	expect((await visit("198.51.100.7")).status).toBe(403);
	expect((await visit()).status).toBe(403);
	expect((await visit("203.0.113.40, 10.0.0.1")).status).toBe(403);
});

test("every office network parses", () => {
	for (let text of OFFICE_NETWORKS) {
		expect(isSuccess(IP.Range.parse(text))).toBe(true);
	}
});
```

The third request in the refusal test is a comma-joined header, which is not one address, so
`ctx.ip` is `null` and the gate holds.

## Where to go next

- [Protect forms from bots and abuse](/docs/identity-and-security/protect-forms) — the network
  key in front of a sign-up form, with a honeypot and a CAPTCHA.
- [Fetch URLs a stranger chose](/docs/identity-and-security/fetch-untrusted-urls) — checking
  every address a name resolves to before connecting.
- [Wire the router: middleware, context and services](/docs/building-remix-apps/wire-the-router)
  — where `getClientIP()` sits in the global chain.
