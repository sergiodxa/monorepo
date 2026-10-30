---
title: Custom domains for your customers
description: Prove a customer owns a domain with a DNS TXT check, register it on Cloudflare for SaaS, and poll it until it serves.
section:
    title: Identity & security
    order: 6
order: 9
lastUpdated: 2026-10-25
outcomes:
    - "How to prove a customer owns a domain with a DNS TXT check"
    - "How to register the proven domain on Cloudflare for SaaS"
    - "How to poll until the certificate is live and tell the customer what is missing"
---

A customer who types `shop.example.com` into your settings page is making a claim. Before your
app serves their site on that name, or asks Cloudflare for a certificate for it, the claim has to
be proven, and the proof that works for any domain is DNS: you show them a TXT record, they
publish it, and you look it up.

This guide builds that flow end to end. [`@sdxc/doh`](/api/doh) does the lookup over DNS over
HTTPS, [`@sdxc/hostname`](/api/hostname) registers the proven domain as a Cloudflare for SaaS
custom hostname, and [`@sdxc/jobs`](/api/jobs) retries both checks in the background until DNS
catches up.

```bash
npm add @sdxc/backoff @sdxc/crypto @sdxc/doh @sdxc/hostname @sdxc/http @sdxc/jobs \
	@sdxc/result @sdxc/validate remix
```

## Declare the two jobs

Proving ownership waits on the customer to publish a record, and activating the hostname waits
on Cloudflare to issue a certificate. Each gets its own job, keyed by your own domain row:

```typescript {% title="app/jobs/index.ts" %}
import { job, jobs } from "@sdxc/jobs";
import * as s from "remix/data-schema";

export default jobs({
	domains: {
		verify: job({ input: s.object({ domainId: s.string() }) }),
		activate: job({ input: s.object({ domainId: s.string() }) }),
	},
});
```

[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) builds the queue, the
dispatcher, and the `ctx.jobs` route handlers enqueue through.

## Show the customer a record to publish

The record lives at an underscore name, so it never collides with TXT records the customer
keeps at the apex, such as SPF. Its value carries a random token stored on the domain row:

```typescript {% title="app/services/domains/challenge.ts" %}
export interface Challenge {
	name: string;
	value: string;
}

export function challengeFor(hostname: string, token: string): Challenge {
	return {
		name: `_yourapp-challenge.${hostname}`,
		value: `yourapp-verification=${token}`,
	};
}
```

The action that adds a domain validates the form, stores the row with a fresh token, and
enqueues the first check:

```tsx {% title="app/http/controllers/domains/add.tsx" %}
import { randomToken } from "@sdxc/crypto";
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import { Domains } from "~/app/models/domains";
import jobs from "~/app/jobs";
import { DomainsPage } from "~/resources/views/domains";
import routes from "~/routes/web";

const HOSTNAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/;

const ADD_DOMAIN = f.object({
	hostname: f.field(
		s
			.string()
			.transform((value) => value.trim().toLowerCase().replace(/\.$/, ""))
			.refine(
				(value) => HOSTNAME.test(value),
				"Enter a domain like shop.example.com",
			),
	),
});

export default createAction(routes.domains.create, async (ctx) => {
	let form = await validate(ctx.formData, ADD_DOMAIN);
	if (isFailure(form)) {
		let page = <DomainsPage issues={form.error.issues} />;
		return ctx.render(page, { status: 400 });
	}

	let domain = await Domains.create(ctx.db, {
		accountId: ctx.account.id,
		hostname: form.data.hostname,
		token: randomToken({ bytes: 16 }),
	});
	await ctx.jobs.enqueue(jobs.domains.verify, { domainId: domain.id });

	return redirect(routes.domains.index.href(), {
		status: redirect.Status.SeeOther,
	});
});
```

`Domains` is your own table, and `ctx.account` is the signed-in account your auth middleware
publishes. The schema lowercases the name and drops a trailing dot, since `Shop.Example.com.`
is the same domain. The settings page renders `challengeFor(domain.hostname, domain.token)`
beside every unverified domain.

## Check the record until it appears

The verify job looks the record up with `verifyTxtRecord`. A name that does not exist yet is
`success(false)`, while a resolver that failed to answer is a failure:

```typescript {% title="app/jobs/domains/verify.ts" %}
import { createBackoff } from "@sdxc/backoff";
import { verifyTxtRecord } from "@sdxc/doh";
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import { Domains } from "~/app/models/domains";
import { challengeFor } from "~/app/services/domains/challenge";
import jobs from "~/app/jobs";
import { dispatcher } from "~/app/initializers/dispatcher";

const recheck = createBackoff({ base: "1 minute", max: "15 minutes" });

export default createJobHandler(jobs.domains.verify, async (ctx) => {
	let domain = await Domains.find(ctx.db, ctx.input.domainId);
	if (domain === null) return ctx.exit("The domain was removed");
	if (domain.verifiedAt !== null) return ctx.ack("Already verified");

	let challenge = challengeFor(domain.hostname, domain.token);
	let found = await verifyTxtRecord(challenge.name, challenge.value);
	if (isFailure(found)) {
		return ctx.retry({ delay: "5 minutes", cause: found.error });
	}

	if (!found.data) {
		return ctx.retry({
			delay: recheck.delay(ctx.attempts),
			reason: "The TXT record is not published yet",
		});
	}

	await Domains.markVerified(ctx.db, domain.id);
	await dispatcher.enqueue(jobs.domains.activate, { domainId: domain.id });
});
```

A missing record retries soon at first, since the customer is probably at their DNS host right
now, then backs off to every fifteen minutes; a resolver can keep a "no such name" answer for
the zone's negative-caching TTL. A failed lookup is retried as an unknown, never read as "not
published". A match marks the row and hands over to the next job.

> [!NOTE]
> The queue consumer's `max_retries` bounds how long the job keeps trying, so set it to cover the
> window you promise customers, and give the settings page a "Check again" button that enqueues
> the job afresh once it gives up.

## Register the proven domain

Registration waits for proof, so every custom hostname in your zone is one a customer showed
they control. The client is bound to one zone and holds only configuration:

```typescript {% title="app/initializers/hostnames.ts" %}
import { HostnameClient } from "@sdxc/hostname";
import { env } from "cloudflare:workers";

export const FALLBACK_ORIGIN = "customers.yourapp.example";

export function hostnameClient(): HostnameClient {
	return new HostnameClient({
		apiToken: env.CF_API_TOKEN,
		zoneId: env.CF_ZONE_ID,
		metadataKey: "account_id",
	});
}
```

`metadataKey` is where `create` tags each hostname with its owner. `FALLBACK_ORIGIN` is the
name in your own zone that customers point their domain at with a CNAME record.

## Poll until the certificate is live

The activate job registers the hostname on its first run and polls it after, until Cloudflare
reports both the hostname and its certificate as active. `getStatusMessage` turns Cloudflare's
status fields into one sentence for the settings page, such as "Pending DNS validation":

```typescript {% title="app/jobs/domains/activate.ts" %}
import { HostnameClient } from "@sdxc/hostname";
import { createJobHandler } from "@sdxc/jobs";

import { Domains } from "~/app/models/domains";
import jobs from "~/app/jobs";
import { hostnameClient } from "~/app/initializers/hostnames";

export default createJobHandler(jobs.domains.activate, async (ctx) => {
	let domain = await Domains.find(ctx.db, ctx.input.domainId);
	if (domain === null) return ctx.exit("The domain was removed");

	let client = hostnameClient();
	let hostname =
		domain.hostnameId === null
			? ((await client.getByName(domain.hostname)) ??
				(await client.create(domain.hostname, domain.accountId)))
			: await client.status(domain.hostnameId);

	let certificate = HostnameClient.getValidationTxtRecord(hostname);
	let message = HostnameClient.getStatusMessage(hostname);
	await Domains.recordHostname(ctx.db, domain.id, {
		hostname,
		certificate,
		message,
	});

	if (!HostnameClient.isActive(hostname)) {
		return ctx.retry({ delay: "2 minutes", reason: message });
	}
});
```

Looking the name up with `getByName` before `create` makes the first run safe to repeat: a
retry adopts a hostname an earlier run registered instead of registering it twice.
`getValidationTxtRecord` returns the certificate's own TXT record while it is pending, and
`null` after, so the settings page shows it only while the customer needs it. The client throws
`HostnameApiError`, which in a job is a failed delivery the queue retries.

## Remove a domain

Delete the custom hostname first and the row second, so a failed Cloudflare call leaves the row
to retry from. A hostname that is already gone answers `404`, which counts as done:

```typescript {% title="app/http/controllers/domains/remove.ts" %}
import { HostnameApiError } from "@sdxc/hostname";
import { redirect } from "@sdxc/http/response";
import { notFound } from "@sdxc/http/response/html";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { Domains } from "~/app/models/domains";
import { hostnameClient } from "~/app/initializers/hostnames";
import routes from "~/routes/web";

export default createAction(routes.domains.destroy, async (ctx) => {
	let { id } = s.parse(s.object({ id: s.string() }), ctx.params);
	let domain = await Domains.findForAccount(ctx.db, ctx.account.id, id);
	if (domain === null) return notFound("Not Found");

	if (domain.hostnameId !== null) {
		try {
			await hostnameClient().delete(domain.hostnameId);
		} catch (error) {
			let gone = error instanceof HostnameApiError && error.statusCode === 404;
			if (!gone) throw error;
		}
	}

	await Domains.remove(ctx.db, domain.id);
	return redirect(routes.domains.index.href(), {
		status: redirect.Status.SeeOther,
	});
});
```

> [!WARNING]
> Look the domain up with `findForAccount`, scoped to the signed-in account. A lookup by id alone
> lets one customer remove another's domain by guessing its id.

## Test the verify job

Run the job through a dispatcher over a memory queue and the in-memory D1 from
[Query D1 and Durable Object SQL](/docs/data-and-background-work/databases), and answer the DNS
query with MSW at the resolver `@sdxc/doh` asks by default:

```typescript {% title="app/jobs/domains/verify.test.ts" %}
import { CLOUDFLARE } from "@sdxc/doh";
import * as memory from "@sdxc/jobs/memory";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";

import { createDispatcher } from "~/app/initializers/dispatcher";
import jobs from "~/app/jobs";
import { Domains } from "~/app/models/domains";
import { createTestDatabase } from "~/app/test/database";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function publish(records: string[]) {
	server.use(
		http.get(CLOUDFLARE.url, ({ request }) => {
			let name = new URL(request.url).searchParams.get("name");
			let Answer = records.map((data) => ({
				name: `${name}.`,
				type: 16,
				TTL: 60,
				data,
			}));
			return HttpResponse.json(
				records.length ? { Status: 0, Answer } : { Status: 3 },
			);
		}),
	);
}

async function runVerify(token: string) {
	let db = await createTestDatabase();
	let domain = await Domains.create(db, {
		accountId: "account-1",
		hostname: "shop.example.com",
		token: "token-1",
	});
	let queue = memory.queue();
	let dispatcher = createDispatcher({ queue, openDb: () => db });

	publish(token ? [`"yourapp-verification=${token}"`] : []);
	await dispatcher.enqueue(jobs.domains.verify, { domainId: domain.id });
	let settlements = await queue.drain((delivery) => dispatcher.deliver(delivery));
	return { settlements, domain: await Domains.find(db, domain.id) };
}

test("retries while the record is missing", async () => {
	let { settlements, domain } = await runVerify("");

	expect(settlements).toMatchObject([{ type: "retry" }]);
	expect(domain?.verifiedAt).toBeNull();
});

test("marks the domain verified once the record matches", async () => {
	let { settlements, domain } = await runVerify("token-1");

	expect(settlements).toEqual([{ type: "ack" }]);
	expect(domain?.verifiedAt).not.toBeNull();
});
```

A name that does not exist yet is `Status: 3`, NXDOMAIN. The verified run hands over to the
activate job through the app's dispatcher, so `QUEUE` in `app/test/cloudflare-workers.ts`
receives that message.

## Where to go next

- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — the dispatcher,
  retries, and the queue configuration `max_retries` lives in.
- [`@sdxc/doh`](/api/doh) — `resolve` for any record type, and the error classes that tell a
  missing name from a failing resolver.
- [Check a domain's email authentication](/docs/data-and-background-work/email-authentication)
  — the DMARC, SPF and DKIM records to check once you send mail from a proven domain.
