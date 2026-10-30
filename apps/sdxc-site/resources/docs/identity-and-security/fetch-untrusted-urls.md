---
title: Fetch URLs a stranger chose
description: Refuse private hosts at the endpoint, fetch in a job under one deadline and a byte cap on every redirect, and cap a request body before you read it.
section:
    title: Identity & security
    order: 6
order: 11
lastUpdated: 2026-10-25
outcomes:
    - "How to refuse private hosts at the endpoint before a URL is stored"
    - "How to fetch under one deadline and a byte cap on every redirect"
    - "How to cap an incoming request body before you read it"
---

The moment your app fetches a URL someone typed, a calendar to subscribe to, an avatar to copy,
a feed to poll, your Worker sends requests on that person's behalf. They can point it at
`http://169.254.169.254/`, where a cloud metadata service answers, at `printer.local` or a
`10.x` address on a network you reach, or at a public page that redirects to either. They can
also point it at a server that drips one byte a second, or answers with a body that never ends.

This guide builds a calendar subscription that answers all of it: the endpoint refuses a URL
that can never be fetched, and a background job follows it under one deadline and a byte cap
with every redirect re-checked. [`@sdxc/outbound`](/api/outbound) checks, follows and reads the
URL, and [`@sdxc/jobs`](/api/jobs) keeps the fetch off the request.

```bash
npm add @sdxc/crypto @sdxc/http @sdxc/jobs @sdxc/outbound @sdxc/result @sdxc/validate \
	remix
```

## Refuse the URL at the endpoint

`checkUrl` decides from the URL alone: HTTP(S) only, no username or password, and a host that
is a public address or a name outside the reserved suffixes (`localhost`, `local`, `internal`
and the rest). Running it where the URL arrives turns a subscription the job would refuse into
an immediate `422`:

```typescript {% title="app/http/controllers/calendars/create.ts" %}
import { accepted, unprocessableEntity } from "@sdxc/http/response/json";
import { checkUrl } from "@sdxc/outbound";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import jobs from "~/app/jobs";
import { Calendars } from "~/app/models/calendars";
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

The check runs on the parsed URL, so `http://0x7f.1/` is judged as the `127.0.0.1` it
normalizes to, and the error's code names the rule that refused it. `ports: "default"` allows
only the scheme's own port, which keeps the URL off a database or admin port on a public host.
`Calendars` is your own model, and
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) builds the queue and
`ctx.jobs`.

## Follow and read it under one deadline

`follow` walks the redirect chain itself, so every hop passes `checkUrl` with the same options
before it is requested: a public page redirecting to `127.0.0.1` fails `refused-address`
without the second request leaving. `readText` then reads the body within a byte cap. Wrap both
in a function that translates `OutboundError` into your own error:

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

The `timeout` covers the whole chain and the body read after it, so a server that drips the
body still fails at ten seconds. The cap is counted off the stream, so a body that lies about
its length fails at the byte that crosses it. `follow` answers the final response whatever its
status, since what a status means is yours to decide, and `release` lets go of a body you will
not read.

## Turn failures into job verbs

`retryable` is `true` for `timeout` and `network` alone, the outcomes a later attempt can
change. Every other code gives the same answer next time, so the job records it and stops:

```typescript {% title="app/jobs/calendars/refresh.ts" %}
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import jobs from "~/app/jobs";
import { Calendars } from "~/app/models/calendars";
import { downloadCalendar } from "~/app/services/calendar-download";

const MAX_ATTEMPTS = 4;

export default createJobHandler(jobs.calendars.refresh, async (ctx) => {
	let calendar = await Calendars.find(ctx.db, ctx.input.calendarId);
	if (calendar === null) return ctx.exit("The calendar was removed");

	let download = await downloadCalendar(calendar.url);
	if (isFailure(download)) {
		let { code, retryable } = download.error;
		ctx.log.set({ calendar: { failure: code, attempts: ctx.attempts } });
		if (retryable && ctx.attempts < MAX_ATTEMPTS) {
			return ctx.retry({ delay: "15 minutes", cause: download.error });
		}
		await Calendars.markBroken(ctx.db, calendar.id, code);
		return;
	}

	let { bytes, text, url } = download.data;
	await Calendars.store(ctx.db, calendar.id, { url: url.href, text });
	ctx.log.set({ calendar: { bytes } });
});
```

A broken subscription is an outcome your interface shows, so the job stores the code and
returns, which acks the message. `ctx.exit` is for a row that no longer exists.

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

The lookup's time counts against `timeout`, and a resolver that could not answer fails
`network`, which is retryable.

> [!WARNING]
> A Worker connects to a name, and the addresses that were checked stay with the check. A name
> that answers with a public address to the check and a private one to the connection still gets
> through: DNS checks narrow rebinding and leave it open. What holds regardless is architecture:
> a Worker that reaches its storage and its other services through bindings rather than URLs has
> nothing private for an escaped request to reach.

## Cap a body that did not come from fetch

`readText` and `readBytes` take any `Request` or `Response`, including an incoming request. A
webhook endpoint reads the delivery before it can check the signature, so whoever posts decides
how much your Worker buffers unless you cap it:

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

A `Content-Length` over the cap is answered `413` before any of the body is read. For a sender
that follows [Standard Webhooks](/docs/identity-and-security/webhooks), `@sdxc/webhooks` reads
and verifies the body itself.

Packages that fetch URLs a stranger chose, such as [`@sdxc/feed`](/api/feed),
[`@sdxc/distill`](/api/distill) and [`@sdxc/activitypub`](/api/activitypub), do it through
`@sdxc/outbound`, so the same hop checks, deadline and caps apply without your code calling it.

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
its records, so answer that URL too.

## Where to go next

- [Read other people's pages](/docs/content-and-feeds/read-web-pages) — articles and preview
  cards from a URL someone saved.
- [Client addresses and networks](/docs/identity-and-security/client-addresses) — the address
  ranges `checkUrl` judges a literal by.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — the dispatcher
  and the verbs the refresh job uses.
