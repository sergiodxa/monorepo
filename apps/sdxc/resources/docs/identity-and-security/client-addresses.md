---
title: Client addresses and networks
description: Read the caller's address once per request, key limits on its network, store it as text, admit only your own networks and refuse internal targets.
section:
    title: Identity & security
    order: 5
order: 12
lastUpdated: 2026-10-08
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
npm add @sdxc/ip @sdxc/get-client-ip @sdxc/rate-limit @sdxc/result \
	@sdxc/validate @sdxc/http remix
```

## Publish the address once

Add the middleware to the router's global chain. It reads the `CF-Connecting-IP` header
Cloudflare attaches to every request it routes, parses it, and publishes the result as `ctx.ip`
before any route middleware or handler runs.

```tsx {% title="bootstrap/app.tsx" %}
import type { Middleware } from "remix/router";

import getClientIP from "@sdxc/get-client-ip/middleware";
import { log } from "@sdxc/logger/middleware";
import { createRouter } from "remix/router";

import defaultHandler from "~/app/http/controllers/default-handler";
import routes from "~/routes/web";

import { logger } from "./logger";

export default function application() {
	let middleware: Middleware[] = [
		log(logger) as Middleware,
		getClientIP(),
		// …then cop(), formData() and a renderer
	];

	let router = createRouter({ middleware, defaultHandler });
	// router.map(…) for each route
	return router;
}
```

Importing the middleware module types `ctx.ip` as `IP | null` across your project, so a handler
reads it like any other property. Code that holds a context without the property installed, such
as a helper typed against a bare `RequestContext`, reads the same value with `ctx.get(ClientIP)`,
importing the `ClientIP` key from the same module; on a context the middleware never ran on, the
key answers `null`.

## Decide what `null` means

`ctx.ip` is `null` in two cases: the header is absent, which happens exactly when something
other than Cloudflare's edge served the request (a local dev server, a test, another host), or
the header is present and is not one address. Both mean the same thing to your app: nobody
vouched for the caller's address. Pick the answer per use, by what an unknown caller should get:

- A **budget** shares one bucket across every unknown caller, so it stays finite.
- A **gate** refuses, because admitting an unknown caller is the same as having no gate.
- A **record** stores `null`, so the column says "unknown" rather than a made-up value.

The sections below take each of those in turn.

## Key a budget on the client's network

An IPv6 client is normally handed a whole `/64`, and its operating system rotates through
addresses inside it on its own. A limit keyed on the full address gives that client a fresh
budget with every rotation. `addressKey` from `@sdxc/rate-limit` keys on the network the
address sits in instead: the address itself for IPv4, its `/64` for IPv6, written as canonical
text. A `null` address answers `"unknown"`, the one bucket every unidentified caller shares.

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
`2001:db8:1:2:0:0:0:9` spend the same budget. A `/64` is the narrowest prefix that is reliably
one subscriber. A provider that hands out a `/56` or a `/48` lets a client spread across
several keys; to cap that, key on `ctx.ip?.network({ v4: 32, v6: 56 }).toString() ?? "unknown"`
yourself, at the cost of grouping more neighbours behind one budget.
[Protect forms from bots and abuse](/docs/identity-and-security/protect-forms) puts this key in
front of a sign-up form, with a CAPTCHA after it.

## Pass an `IP`, not a string

A function that takes an `IP` cannot be handed `"unknown"` or a hostname, so the check happens
once, where the value enters. Write your own services against the type:

```typescript {% title="app/services/sign-ins.ts" %}
import type { Database } from "remix/data-table";

import { IP } from "@sdxc/ip";
import { isSuccess } from "@sdxc/result";

import { SignIns } from "~/app/repositories/sign-ins";

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

`SignIns` is your own repository over a table with a text `ip` column. `toString()` writes the
canonical form, so equal addresses store equal strings and an index on the column finds them.
Reading it back goes through `IP.parse`, which turns a row written by older code, or edited by
hand, into a failure you handle instead of a value you trust.

Compare two addresses or two networks with `equals`. Two `IP`s parsed from the same text are
two objects, and `===` compares objects by identity. The same goes for anything that crosses a
structured clone, such as Durable Object storage or `postMessage`: the copy arrives without its
methods, so store `toString()` and parse it on the other side.

A handler hands over what the middleware published:

```typescript {% title="app/http/controllers/sessions/create.ts" %}
await recordSignIn(ctx.db, user.id, ctx.ip);
if (ctx.ip && (await isNewNetwork(ctx.db, user.id, ctx.ip))) {
	ctx.log.set({ sign_in: { new_network: true } });
}
```

## Write it into the log

An `IP` serializes as its canonical text through `toJSON`, and `toString()` makes that explicit
when you add it to the request's record:

```typescript {% title="app/http/controllers/sessions/create.ts" %}
ctx.log.set({ client: { ip: ctx.ip?.toString() ?? null } });
```

One field on the record that is already open covers the whole request, so a query groups by
client without each handler writing its own line. An IP address is personal data in many
jurisdictions; decide how long your logs keep it before you add the field.

## Admit only your own networks

An admin area that only staff on the office network or the VPN should reach is a list of
ranges and a membership test. Keep the list as plain strings at module level, and parse inside
the function: a Worker that does work in its global scope fails upload validation, and parsing a
handful of ranges per request costs microseconds.

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

Install `officeOnly()` in the `middleware` of the admin routes' `router.map`, after the global
chain has published `ctx.ip`. A request with no usable address is refused with the rest.

`IP.Range.parse` refuses `203.0.113.1/24` with `host-bits-set`, because an address with bits
past its prefix names a host where a network was meant. A typo in the list therefore fails to
parse rather than silently matching a different network, and the test at the end of this guide
asserts every entry parses. `contains` never matches across versions, so an IPv4 range admits
no IPv6 client: list the office's IPv6 prefix too when it has one.

## Refuse an internal address someone typed

A webhook target, an uptime probe or an avatar URL is a host chosen by someone else, and your
Worker will connect to it. When that host is an address literal, `@sdxc/ip` classifies it before
anything is stored:

```typescript {% title="app/http/controllers/webhooks/create.ts" %}
import { created, unprocessableEntity } from "@sdxc/http/response/json";
import { IP } from "@sdxc/ip";
import { isFailure, isSuccess } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { Webhooks } from "~/app/repositories/webhooks";
import routes from "~/routes/web";

const WEBHOOK = s.object({ url: s.string() });

export default createAction(routes.webhooks.create, async (ctx) => {
	let body = await validate(ctx.request, WEBHOOK);
	if (isFailure(body)) return unprocessableEntity({ issues: body.error.issues });

	let url = URL.parse(body.data.url);
	if (url === null) return unprocessableEntity({ error: "That is not a URL." });

	let literal = IP.parse(url.hostname);
	if (isSuccess(literal) && !literal.data.isPublic) {
		return unprocessableEntity({
			error: "That address is not on the public internet.",
			classification: literal.data.classification,
		});
	}

	let webhook = await Webhooks.save(ctx.db, { url: url.href });
	return created({ id: webhook.id });
});
```

Parse the URL first and classify its `hostname`. `URL` rewrites the octal, hex and bare-integer
spellings of IPv4 (`http://0x7f.1/`, `http://2130706433/`) into dotted decimal, which is the
only IPv4 form `IP.parse` accepts, and keeps the brackets on IPv6, which `IP.parse` reads.
`classification` names why an address was refused (`loopback`, `private`, `link-local`,
`documentation` and the rest), so the response can say which.

IPv6 can carry an IPv4 address inside it: IPv4-mapped (`::ffff:10.0.0.1`), NAT64
(`64:ff9b::a00:1`) and 6to4 addresses. `classification` and `isPublic` judge those by the IPv4
inside, so all three spellings of `10.0.0.1` are `private`, and `embeddedIPv4` answers the inner
address when you want to log or show it.

A name is the other half. `hooks.example.com` passes this check and can still resolve to
`127.0.0.1`, and a redirect can lead anywhere. Checking every address a name resolves to, on
every hop, belongs in the fetch itself:
[Fetch URLs a stranger chose](/docs/identity-and-security/fetch-untrusted-urls) covers that.

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

The third request in the refusal test is what a header repeated across two lines reads as: a
comma-joined string, which is not one address, so `ctx.ip` is `null` and the gate holds. Use the
documentation ranges (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`, `2001:db8::/32`) for
test addresses; they are reserved for examples and never belong to a real client.

## Where to go next

- [Protect forms from bots and abuse](/docs/identity-and-security/protect-forms) — the network
  key in front of a sign-up form, with a honeypot and a CAPTCHA.
- [Fetch URLs a stranger chose](/docs/identity-and-security/fetch-untrusted-urls) — checking
  every address a name resolves to before connecting.
- [Wire the router: middleware, context and services](/docs/building-remix-apps/wire-the-router)
  — where `getClientIP()` sits in the global chain.
- [Build a JSON API with problem details](/docs/http-apis/json-apis) — rate
  limiting an API with the same key.
- [Logs, traces and timings](/docs/operations-and-testing/observability) — querying the record
  the address is written into.
