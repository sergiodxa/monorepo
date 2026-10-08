---
title: Fetch URLs a stranger chose
description: Refuse private hosts at the endpoint, fetch in a job under one deadline and a byte cap on every redirect, and cap bodies that never came from fetch.
section:
    title: Identity & security
    order: 5
order: 11
lastUpdated: 2026-10-08
---

The moment your app fetches a URL someone typed, a calendar to subscribe to, an avatar to copy,
a feed to poll, your Worker sends requests on that person's behalf. They can point it at
`http://169.254.169.254/`, where a cloud metadata service answers, at `printer.local` or a
`10.x` address on a network you reach, or at a public page that redirects to either. They can
also point it at a server that drips one byte a second, or answers with a body that never ends.
Every one of those holds the request open, reads into memory, or reaches something nobody
outside should.

This guide builds a calendar subscription that answers all of it: the endpoint refuses a URL
that can never be fetched, a background job follows it under one deadline and a byte cap with
every redirect re-checked, and the failures map onto the job's retry and give-up verbs. Then it
caps bodies that did not come from `fetch` at all, such as a webhook delivery, and streams a
capped image through a proxy.

[`@sdxc/outbound`](/api/outbound) checks, follows and reads URLs a stranger chose, answering a
`Result` from [`@sdxc/result`](/api/result) for every outcome. [`@sdxc/jobs`](/api/jobs) keeps
the fetch off the request, and [`@sdxc/crypto`](/api/crypto) verifies the webhook signature.

```bash
npm add @sdxc/outbound @sdxc/result @sdxc/jobs @sdxc/crypto @sdxc/validate \
	@sdxc/http remix
```

## Refuse the URL at the endpoint

`checkUrl(input, options)` decides from the URL alone, with no request and no lookup: HTTP(S)
only, no username or password, and a host that is a public address or a name with a dot outside
the reserved suffixes (`localhost`, `local`, `internal`, `lan`, `home.arpa`, `test` and the
rest). Running it where the URL arrives turns a subscription the job would refuse into an
immediate `422`:

```typescript {% title="app/http/controllers/calendars/create.ts" %}
import { accepted, unprocessableEntity } from "@sdxc/http/response/json";
import { checkUrl } from "@sdxc/outbound";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import jobs from "~/app/jobs";
import { Calendars } from "~/app/repositories/calendars";
import routes from "~/routes/web";

const SUBSCRIBE = s.object({ url: s.string() });

export default createAction(routes.calendars.create, async (ctx) => {
	let body = await validate(ctx.request, SUBSCRIBE);
	if (isFailure(body)) return unprocessableEntity({ issues: body.error.issues });

	let url = checkUrl(body.data.url, { ports: "default" });
	if (isFailure(url)) {
		return unprocessableEntity({ error: url.error.code, url: url.error.url });
	}

	let calendar = await Calendars.save(ctx.db, { url: url.data.href });
	await ctx.jobs.enqueue(jobs.calendars.refresh, { calendarId: calendar.id });
	return accepted({ id: calendar.id });
});
```

The check runs on the parsed URL, so `http://0x7f.1/` and `http://2130706433/` are judged as the
`127.0.0.1` they normalize to, and an IPv6 address carrying an IPv4 one inside, such as
`::ffff:10.0.0.1`, is judged by the IPv4. The code names the rule that refused it
(`refused-address`, `refused-host`, `refused-port`, `refused-scheme`, `refused-credentials`,
`invalid-url`), so the form can say which.

`ports: "default"` allows only the scheme's own port, which keeps the URL off a database or
admin port on a public host. A list such as `[80, 443, 8443]` allows the ports it names, an
omitted port counting as the scheme's own. `literals: "refuse"` refuses every address literal,
public or not, for a feature where a name is the only sensible input. `Calendars` is your own
repository, and the job is declared as `refresh: job({ input: s.object({ calendarId:
s.string() }) })`; [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron)
builds the queue and `ctx.jobs`.

## Follow and read it under one deadline

`follow(input, options)` requests the URL with `redirect: "manual"` and `credentials: "omit"`
and walks the chain itself, so every hop passes `checkUrl` with the same options before it is
requested. A public page redirecting to `127.0.0.1` fails `refused-address` without the second
request leaving. `readText` then reads the body within a byte cap. Wrap both in a function that
translates `OutboundError` into your own error, so the job handles one type:

```typescript {% title="app/services/calendar-download.ts" %}
import type { OutboundError, OutboundErrorCode } from "@sdxc/outbound";

import { follow, readText, release } from "@sdxc/outbound";
import { failure, isFailure, success } from "@sdxc/result";

const USER_AGENT = "Planner/1.0 (+https://planner.example/about/bot)";
const MAX_CALENDAR_BYTES = 2 * 1024 * 1024;

export class CalendarError extends Error {
	override name = "CalendarError";

	constructor(
		readonly code: OutboundErrorCode | "rejected",
		readonly retryable: boolean,
		message: string,
	) {
		super(message);
	}
}

function fromOutbound(error: OutboundError): CalendarError {
	return new CalendarError(error.code, error.retryable, error.message);
}

export async function downloadCalendar(input: string) {
	let followed = await follow(input, {
		headers: { accept: "text/calendar", "user-agent": USER_AGENT },
		timeout: "10 seconds",
		maxRedirects: 5,
		ports: "default",
	});
	if (isFailure(followed)) return failure(fromOutbound(followed.error));

	let { response, url } = followed.data;
	if (!response.ok) {
		release(response.body);
		let retryable = response.status === 429 || response.status >= 500;
		let message = `${url.href} answered ${response.status}`;
		return failure(new CalendarError("rejected", retryable, message));
	}

	let body = await readText(response, { maxBytes: MAX_CALENDAR_BYTES });
	if (isFailure(body)) return failure(fromOutbound(body.error));

	return success({ url, text: body.data.text, bytes: body.data.bytes });
}
```

The `timeout` covers the whole chain and the body read after it: the deadline travels with the
response, so a server that sends headers quickly and then drips the body fails `timeout` at ten
seconds all the same. The cap is counted off the stream. A `Content-Length` over it fails
before a byte is read, and a body that lies about its length fails at the byte that crosses the
cap, with the stream cancelled so the origin stops sending.

`follow` answers the final response whatever its status, because what a status means is yours
to decide: a `304` is a success to a feed poller and a `403` a refusal to an article reader.
`release` lets go of a body you will not read without waiting on the origin. `url` is where the
chain ended, the base for any relative URL in the body. Keeping `CalendarError` at this boundary
means the rest of your app never imports `@sdxc/outbound`, and swapping how the calendar is
fetched changes one file.

## Turn failures into job verbs

`retryable` is `true` for `timeout` and `network` alone, the two outcomes a later attempt can
change. Every `refused-*` code, `too-many-redirects` and `too-large` gives the same answer next
time, so the job records it and stops:

```typescript {% title="app/jobs/calendars/refresh.ts" %}
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import jobs from "~/app/jobs";
import { Calendars } from "~/app/repositories/calendars";
import { downloadCalendar } from "~/app/services/calendar-download";

const MAX_ATTEMPTS = 4;

export default createJobHandler(jobs.calendars.refresh, async (ctx) => {
	let calendar = await Calendars.find(ctx.database, ctx.input.calendarId);
	if (calendar === null) return ctx.exit("The calendar was removed");

	let download = await downloadCalendar(calendar.url);
	if (isFailure(download)) {
		let { code, retryable } = download.error;
		ctx.log.set({ calendar: { failure: code, attempts: ctx.attempts } });
		if (retryable && ctx.attempts < MAX_ATTEMPTS) {
			return ctx.retry({ delay: "15 minutes", cause: download.error });
		}
		await Calendars.markBroken(ctx.database, calendar.id, code);
		return;
	}

	let { bytes, text, url } = download.data;
	await Calendars.store(ctx.database, calendar.id, { url: url.href, text });
	ctx.log.set({ calendar: { bytes } });
});
```

A broken subscription is an outcome your interface shows, "the calendar at this address is too
large", so the job stores the code and returns, which acks the message. `ctx.exit` is for a
message that can never succeed for a reason that is yours, such as a row that no longer exists.
A fixed fifteen minutes is the simplest delay;
[Retry on a growing delay](/docs/data-and-background-work/retry-with-backoff) spaces the
attempts out instead.

## Check where the name points

`checkUrl` judges a name by its spelling, so `intranet.attacker.example.com` passes while its
`A` record says `10.0.0.5`. `resolve: true` resolves every hop's name over DNS-over-HTTPS before
requesting it, and refuses the hop when any address it answers with is not public:

```typescript {% title="app/services/calendar-download.ts" %}
let followed = await follow(input, {
	headers: { accept: "text/calendar", "user-agent": USER_AGENT },
	timeout: "10 seconds",
	ports: "default",
	resolve: true,
});
```

The lookup's time counts against `timeout`. `resolveHost(url)` is the same lookup on its own,
answering every address when all are public, so the endpoint can call it on the URL `checkUrl`
passed and answer `422` for `refused-host` (a name that does not exist) or `refused-address`.
A resolver that could not answer fails `network`, which is retryable: accept the URL then, and
let the job's own check decide.

Know the limit. A Worker cannot pin its connection to the addresses that were checked, so a
name that answers with a public address to the check and a private one to the connection still
gets through. DNS checks narrow rebinding and leave it open. What holds regardless is
architecture: a Worker that reaches its storage and its other services through bindings rather
than URLs has nothing private for an escaped request to reach.

## Reach your own network on purpose

Some URLs are yours: a health endpoint behind a tunnel, a feed served by another service on
your network. `hosts: "any"` keeps only the scheme and credential rules and drops the host and
address checks, and `resolve` is skipped with them. Give it a URL you configured, never one a
visitor sent:

```typescript {% title="app/services/inventory-health.ts" %}
import { follow, release } from "@sdxc/outbound";
import { isFailure } from "@sdxc/result";
import { env } from "cloudflare:workers";

export async function inventoryIsUp(): Promise<boolean> {
	let followed = await follow(env.INVENTORY_HEALTH_URL, {
		hosts: "any",
		method: "HEAD",
		timeout: "2 seconds",
		maxRedirects: 0,
	});
	if (isFailure(followed)) return false;

	release(followed.data.response.body);
	return followed.data.response.ok;
}
```

`maxRedirects: 0` fails `too-many-redirects` on the first redirect, so a health check reports
the endpoint it was given rather than wherever that endpoint sends it.

## Cap a body that did not come from fetch

`readText` and `readBytes` take any `Request` or `Response`: an incoming request, a Durable
Object stub's answer, a service binding's. A webhook endpoint reads the delivery before it can
check the signature, so whoever posts first decides how much your Worker buffers unless you cap
it. `readBytes` keeps the exact bytes the signature covers:

```typescript {% title="app/http/controllers/webhooks/inventory.ts" %}
import { hmac } from "@sdxc/crypto";
import {
	accepted,
	badRequest,
	payloadTooLarge,
	serviceUnavailable,
	unauthorized,
} from "@sdxc/http/response/json";
import { readBytes } from "@sdxc/outbound";
import { isFailure } from "@sdxc/result";
import { env } from "cloudflare:workers";
import { createAction } from "remix/router";

import jobs from "~/app/jobs";
import routes from "~/routes/web";

const MAX_DELIVERY_BYTES = 256 * 1024;

export default createAction(routes.webhooks.inventory, async (ctx) => {
	let secret = env.INVENTORY_WEBHOOK_SECRET;
	if (!secret) return serviceUnavailable({ error: "receiver not configured" });

	let body = await readBytes(ctx.request, { maxBytes: MAX_DELIVERY_BYTES });
	if (isFailure(body)) {
		return body.error.code === "too-large"
			? payloadTooLarge({ error: "delivery too large" })
			: badRequest({ error: "delivery unreadable" });
	}

	let signature = ctx.request.headers.get("x-signature") ?? "";
	let valid = await hmac.verify(secret, body.data.data, signature);
	if (isFailure(valid) || !valid.data) {
		return unauthorized({ error: "invalid signature" });
	}

	let payload = new TextDecoder().decode(body.data.data);
	await ctx.jobs.enqueue(jobs.inventory.sync, { payload });
	return accepted({ received: true });
});
```

A `Content-Length` over the cap is answered `413` before any of the body is read. A missing
secret answers `503` before the body is touched, so an unconfigured receiver accepts nothing.
For a sender that follows [Standard Webhooks](/docs/identity-and-security/webhooks),
`@sdxc/webhooks` reads and verifies the body itself.

## Stream a capped image through

An image proxy fetches what a post embeds, so readers never load it from the publisher and the
publisher never sees their address. The bytes go straight to the client, so read nothing:
`limitBody` keeps the status and headers and wraps the body in a stream that errors at the
first chunk past the cap.

```typescript {% title="app/http/controllers/images/show.ts" %}
import { follow, limitBody, release } from "@sdxc/outbound";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import routes from "~/routes/web";

const IMAGE = s.object({ url: s.string() });
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export default createAction(routes.images.show, async (ctx) => {
	let query = await validate(ctx.url.searchParams, IMAGE);
	if (isFailure(query)) return new Response(null, { status: 400 });

	let followed = await follow(query.data.url, {
		headers: { accept: "image/*" },
		timeout: "10 seconds",
		ports: "default",
	});
	if (isFailure(followed)) return new Response(null, { status: 404 });

	let { response } = followed.data;
	let type = response.headers.get("content-type") ?? "";
	if (!response.ok || !type.startsWith("image/")) {
		release(response.body);
		return new Response(null, { status: 404 });
	}

	let capped = limitBody(response, { maxBytes: MAX_IMAGE_BYTES });
	return new Response(capped.body, {
		headers: {
			"content-type": type,
			"cache-control": "public, max-age=86400",
			"content-security-policy": "default-src 'none'",
		},
	});
});
```

The new `Response` forwards the body and only the headers you chose, so a cookie the origin
set never reaches your readers, and the policy keeps an SVG's scripts from running. A declared
length over the cap errors before a byte is forwarded; a body that crosses it mid-stream breaks
off, and the browser shows a broken image. The ten-second deadline still covers the body, so a
slow origin cannot hold the connection either. Sign the URLs your pages write with
`hmac.sign`, and check the signature here, or the proxy relays anything for anyone.

## Use the packages that already fetch through it

Several packages fetch URLs a stranger chose and do it through `@sdxc/outbound`, so the same
hop checks, deadline and caps apply without your code calling it:

- [`@sdxc/distill`](/api/distill) reads articles and refuses address literals;
  [Read other people's pages](/docs/content-and-feeds/read-web-pages) builds a save-for-later
  feature on it, and link preview cards on `follow` and `readText` directly.
- [`@sdxc/feed`](/api/feed) checks every hop with `hosts: "public"` by default and takes
  `hosts: "any"` for a feed on your own network, beside `maxBytes` and `maxRedirects`.
- [`@sdxc/webmention`](/api/webmention) verifies a mention's source within `maxBytes`,
  `timeoutMs` and `maxRedirects`, and refuses literals.
- [`@sdxc/websub`](/api/websub) caps a hub's delivery with `maxBytes` before it compares the
  signature.
- [`@sdxc/activitypub`](/api/activitypub) fetches every remote actor, key and post through it
  with each hop's host resolved, within one megabyte and ten seconds by default, and accepts a
  document only when its `id` has the origin the chain ended at. Deliveries go to an inbox that
  passed the same checks, with `redirect: "manual"`;
  [Federate a site with ActivityPub](/docs/content-and-feeds/activitypub) builds on both.

Each keeps its own error type and maps from `OutboundError` at its boundary, the way
`downloadCalendar` does.

## Test it with MSW

`follow` calls the global `fetch`, so a test answers it with [MSW](https://mswjs.io/), and
`onUnhandledRequest: "error"` fails any request you did not expect. `example.com` passes the
host rules, since only a `.example` name is reserved:

```typescript {% title="app/services/calendar-download.test.ts" %}
import { isFailure } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";

import { downloadCalendar } from "./calendar-download";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test("a redirect into the network is refused before it is requested", async () => {
	server.use(
		http.get("https://cal.example.com/feed.ics", () =>
			HttpResponse.redirect("http://10.0.0.5/admin", 302),
		),
	);

	let download = await downloadCalendar("https://cal.example.com/feed.ics");

	expect(isFailure(download) && download.error.code).toBe("refused-address");
});
```

Nothing handles `10.0.0.5`, so a request to it would fail the test: the refusal is what keeps
it green. With `resolve: true`, every hop also asks `https://cloudflare-dns.com/dns-query` for
its `A` and `AAAA` records, so answer that URL too, with the addresses each case needs.
[Test Workers apps](/docs/operations-and-testing/testing) covers the server setup.

## Where to go next

- [Read other people's pages](/docs/content-and-feeds/read-web-pages) — articles and preview
  cards from a URL someone saved.
- [Client addresses and networks](/docs/identity-and-security/client-addresses) — the address
  ranges `checkUrl` judges a literal by.
- [Receive and send webhooks](/docs/identity-and-security/webhooks) — Standard Webhooks
  verification, replay protection and signing.
- [Retry on a growing delay](/docs/data-and-background-work/retry-with-backoff) — space out
  the attempts a `timeout` or `network` failure earns.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — the dispatcher
  and the verbs the refresh job uses.
