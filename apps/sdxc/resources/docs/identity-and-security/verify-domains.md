---
title: Custom domains for your customers
description: Prove a customer owns a domain with a DNS TXT check, register it on Cloudflare for SaaS, and poll it until it serves.
section:
    title: Identity & security
    order: 5
order: 9
lastUpdated: 2026-09-29
---

A customer who types `shop.example.com` into your settings page is making a claim. Before your
app serves their site on that name, or asks Cloudflare for a certificate for it, the claim has to
be proven, and the proof that works for any domain is DNS: you show them a TXT record, they
publish it, and you look it up.

This guide builds that flow end to end. [`@sdxc/doh`](/api/doh) does the lookups over DNS over
HTTPS, since a Worker has no DNS socket. [`@sdxc/hostname`](/api/hostname) registers the proven
domain as a Cloudflare for SaaS custom hostname and reports when its certificate is live.
[`@sdxc/jobs`](/api/jobs) runs both checks in the background and retries them until DNS catches
up.

```bash
npm add @sdxc/doh @sdxc/hostname @sdxc/jobs @sdxc/crypto @sdxc/validate @sdxc/result \
	@sdxc/http remix
```

## Declare the two jobs

Proving ownership and activating the hostname are separate waits. The first waits on the
customer to publish a record, and the second waits on Cloudflare to validate and issue a
certificate. Each gets its own job, keyed by your own domain row:

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

Route handlers enqueue through `ctx.jobs`, which `jobEnqueuer(queue)` from `@sdxc/jobs/router`
publishes when it runs in the router's middleware. The queue is the one module both the router
and the dispatcher import:

```typescript {% title="app/router.ts" %}
import { jobEnqueuer } from "@sdxc/jobs/router";
import { createRouter } from "remix/router";

import { queue } from "~/app/jobs/queue";

export const router = createRouter({ middleware: [jobEnqueuer(queue)] });
```

[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) builds that queue and
the dispatcher that delivers from it.

## Show the customer a record to publish

The record lives at an underscore name under the customer's domain, so it never collides with
the TXT records they already keep at the apex, such as SPF. Its value carries a random token
stored on the domain row, so nobody can publish it without reading your settings page:

```typescript {% title="app/domains/challenge.ts" %}
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

The action that adds a domain validates the form with [`@sdxc/validate`](/api/validate),
stores the row with a fresh token from [`@sdxc/crypto`](/api/crypto), and enqueues the first
check at once:

```tsx {% title="app/http/controllers/domains/add.tsx" %}
import { randomToken } from "@sdxc/crypto";
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import { Domains } from "~/app/data/domains";
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

`Domains` is your own table of claimed domains, and `ctx.account` is the signed-in account
your auth middleware publishes. The schema lowercases the name and drops a trailing dot before
checking it, because DNS names compare case-insensitively and a customer pasting
`Shop.Example.com.` means the same domain. The pattern accepts ASCII only, so an
internationalized domain is entered in its `xn--` form, which is the form DNS lookups take. The
settings page renders `challengeFor(domain.hostname, domain.token)` beside every unverified
domain.

## Check the record until it appears

The verify job looks the record up with `verifyTxtRecord`. It answers a `Result<boolean>`: a
name that does not exist yet is `success(false)`, because a record not yet published is the
ordinary state of a verification, while a resolver that failed to answer stays a failure:

```typescript {% title="app/jobs/domains/verify.ts" %}
import { verifyTxtRecord } from "@sdxc/doh";
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import { Domains } from "~/app/data/domains";
import { challengeFor } from "~/app/domains/challenge";
import jobs from "~/app/jobs";
import { dispatcher } from "~/app/jobs/dispatcher";

export default createJobHandler(jobs.domains.verify, async (ctx) => {
	let domain = await Domains.find(ctx.database, ctx.input.domainId);
	if (domain === null) return ctx.exit("The domain was removed");
	if (domain.verifiedAt !== null) return ctx.ack("Already verified");

	let challenge = challengeFor(domain.hostname, domain.token);
	let found = await verifyTxtRecord(challenge.name, challenge.value);
	if (isFailure(found)) {
		return ctx.retry({ delay: "5 minutes", cause: found.error });
	}

	if (!found.data) {
		return ctx.retry({
			delay: ctx.attempts < 5 ? "1 minute" : "15 minutes",
			reason: "The TXT record is not published yet",
		});
	}

	await Domains.markVerified(ctx.database, domain.id);
	await dispatcher.enqueue(jobs.domains.activate, { domainId: domain.id });
});
```

Each outcome ends the run differently. A missing record retries soon at first, since the
customer is probably at their DNS host right now, then backs off. A resolver that could not
answer, a `TransportError` or `ServerFailureError`, is retried as an unknown rather than read
as "not published". A match marks the row and hands over to the next job, and the handler
holds the dispatcher here because it is already running inside it.

Retrying over minutes rather than checking once matters for another reason: a resolver that
answered "no such name" before the record existed can keep that answer for the zone's
negative-caching TTL. The queue consumer's `max_retries` bounds how long the job keeps trying,
so set it to cover the window you promise customers, and give the settings page a "Check
again" button that enqueues the job afresh once it gives up.

## Register the proven domain

Registration waits for proof, so every custom hostname in your zone is one a customer showed
they control, and a stranger claiming someone else's domain costs you nothing beyond a row.
The client is bound to one zone and holds only configuration, so building one per use costs
nothing:

```typescript {% title="app/lib/hostnames.ts" %}
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

`metadataKey` is where `create` tags each hostname with its owner, and where
`listByEntity(accountId)` reads that tag back when you reconcile. `FALLBACK_ORIGIN` is the name
in your own zone that customers point their domain at.

## Poll until the certificate is live

The activate job registers the hostname on its first run and polls it on every run after,
retrying until Cloudflare reports both the hostname and its certificate as active:

```typescript {% title="app/jobs/domains/activate.ts" %}
import { HostnameClient } from "@sdxc/hostname";
import { createJobHandler } from "@sdxc/jobs";

import { Domains } from "~/app/data/domains";
import { setupMessage } from "~/app/domains/status";
import jobs from "~/app/jobs";
import { hostnameClient } from "~/app/lib/hostnames";

export default createJobHandler(jobs.domains.activate, async (ctx) => {
	let domain = await Domains.find(ctx.database, ctx.input.domainId);
	if (domain === null) return ctx.exit("The domain was removed");

	let client = hostnameClient();
	let hostname =
		domain.hostnameId === null
			? ((await client.getByName(domain.hostname)) ??
				(await client.create(domain.hostname, domain.accountId)))
			: await client.status(domain.hostnameId);

	let certificate = HostnameClient.getValidationTxtRecord(hostname);
	let message = await setupMessage(hostname);
	await Domains.recordHostname(ctx.database, domain.id, {
		hostname,
		certificate,
		message,
	});

	if (!HostnameClient.isActive(hostname)) {
		return ctx.retry({ delay: "2 minutes", reason: message });
	}
});
```

Looking the name up with `getByName` before calling `create` is what makes the first run safe to
repeat: if the run registered the hostname and then failed before storing its id, the retry
adopts it instead of registering it twice. `getValidationTxtRecord` returns the certificate's
own TXT record while it is `pending_validation`, and `null` after, so the settings page shows
it only while the customer still needs it. When the customer lets that record expire,
`client.refresh(id)` issues a new one.

The client throws `HostnameApiError` rather than returning a `Result`. In a job that is the
right behavior: an uncaught throw is a failed delivery the queue retries, so a Cloudflare API
outage costs a delay, not a lost domain.

## Tell the customer what is missing

`getStatusMessage` turns Cloudflare's two status fields into one sentence, such as "Pending DNS
validation". The most common thing a customer has left to do is point their domain at you,
and `checkCname` from `@sdxc/doh` can check that directly:

```typescript {% title="app/domains/status.ts" %}
import type { HostnameResult } from "@sdxc/hostname";

import { checkCname } from "@sdxc/doh";
import { HostnameClient } from "@sdxc/hostname";
import { isSuccess } from "@sdxc/result";

import { FALLBACK_ORIGIN } from "~/app/lib/hostnames";

export async function setupMessage(result: HostnameResult): Promise<string> {
	if (HostnameClient.isActive(result)) return "Active";

	let pointed = await checkCname(result.hostname, FALLBACK_ORIGIN);
	if (isSuccess(pointed) && !pointed.data) {
		return `Point ${result.hostname} at ${FALLBACK_ORIGIN} with a CNAME record`;
	}

	return HostnameClient.getStatusMessage(result);
}
```

`checkCname` follows the alias chain one hop at a time, so a customer who points at an
intermediate name of their own still matches, and it compares names without case or the
trailing dot. A failed lookup falls through to Cloudflare's own message, because not knowing
is not the same as knowing the record is wrong.

## Remove a domain

Removing a domain deletes the custom hostname first and the row second. If the Cloudflare call
fails, the row is still there to retry from, and a hostname that is already gone answers `404`,
which counts as done:

```typescript {% title="app/http/controllers/domains/remove.ts" %}
import { HostnameApiError } from "@sdxc/hostname";
import { redirect } from "@sdxc/http/response";
import { notFound } from "@sdxc/http/response/html";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { Domains } from "~/app/data/domains";
import { hostnameClient } from "~/app/lib/hostnames";
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

`findForAccount` scopes the lookup to the signed-in account, so one customer can never remove
another's domain by guessing its id. A verify or activate job still queued for the domain finds
no row and exits for good.

## Where to go next

- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — the dispatcher,
  retries, and the queue configuration `max_retries` lives in.
- [Validate forms and route params](/docs/building-remix-apps/forms-and-params) — rendering the
  issues the add-domain form returns.
- [Hash, sign and encrypt with Web Crypto](/docs/identity-and-security/web-crypto) — the token
  generator and the rest of `@sdxc/crypto`.
- [`@sdxc/doh`](/api/doh) — `resolve` for any record type, and the error classes that tell a
  missing name from a failing resolver.
