---
title: Watch when a domain expires
description: Read a domain's expiry date, status and registrar from its registry over RDAP, sweep every tracked domain on a schedule, and alert before the registration lapses.
section:
    title: Data & background work
    order: 6
order: 16
lastUpdated: 2026-10-08
---

A domain that lapses takes everything on it down at once: the site stops resolving, mail
bounces, and after the redemption period anyone can register the name. The date it happens is
public. Every registry publishes it, along with the domain's status, registrar and nameservers,
over RDAP, the Registration Data Access Protocol: JSON over HTTPS, one server per registry,
found through a bootstrap file IANA maintains.

This guide reads that data and turns it into an expiry monitor. [`@sdxc/rdap`](/api/rdap) finds
the registry and looks the domain up. [`@sdxc/cache`](/api/cache) keeps the bootstrap file
between requests. [`@sdxc/jobs`](/api/jobs) runs the lookups on a cron trigger, and
[`@sdxc/backoff`](/api/backoff) spaces out the retries when a registry has a bad hour.

```bash
npm add @sdxc/rdap @sdxc/cache @sdxc/jobs @sdxc/backoff @sdxc/result remix
```

## Build the client

An `RDAP` client is configured once with a cache and a user agent. The cache holds IANA's
bootstrap file, the map from each TLD to its registry's server, so a lookup costs one request to
the registry rather than two. The user agent goes out on every request, and it is how a registry
that rate-limits identifies who to contact:

```typescript {% title="app/domains/rdap.ts" %}
import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { RDAP } from "@sdxc/rdap";
import { env } from "cloudflare:workers";

export const rdap = new RDAP({
	cache: new WorkerKVCache(env.CACHE),
	userAgent: "ExampleMonitor/1.0 (+https://monitor.example.com)",
});
```

The constructor stores its options and does no work, so the client is safe to build at module
scope. A fetched bootstrap copy is trusted for a day, and an older copy keeps serving when IANA
cannot be reached. `bootstrapTtl`, `timeout` and `maxBytes` change those bounds, and `servers`
points a TLD at a registry IANA does not list yet.

## Look up a domain

`rdap.domain` answers a `Result`. The name can be Unicode or A-label, with or without a trailing
dot; `Bücher.com.` queries `xn--bcher-kva.com`:

```typescript {% title="app/domains/describe.ts" %}
import { isFailure, success } from "@sdxc/result";

import { rdap } from "~/app/domains/rdap";

export async function describeDomain(name: string) {
	let looked = await rdap.domain(name, { related: true });
	if (isFailure(looked)) return looked;

	let { expiresAt, status, registrar, nameservers, dnssec } = looked.data;
	return success({
		expiresAt: expiresAt === null ? null : new Date(expiresAt),
		status,
		registrar: registrar?.name ?? null,
		nameservers,
		dnssec,
	});
}
```

Pass the registration, `example.co.uk` and never `www.example.co.uk`. A registry holds records
for the names registered with it, so a name below one answers `not-found`. An app that already
knows a zone's apex, from a custom-domain setup or an imported zone file, has the right name.

Dates arrive as epoch milliseconds: `expiresAt`, `registeredAt` and `updatedAt`, each `null` when
the registry publishes no such event. Some ccTLD registries publish no expiry at all, so plan for
a domain whose date stays unknown. `status` holds EPP status codes in their usual spelling, such
as `clientTransferProhibited` or `pendingDelete`. `document` keeps the registry's response as sent
for any field the model leaves out.

`related: true` is for `.com` and `.net`, whose registries hold the dates and link to the
registrar's own RDAP server for the rest. The client follows that link and fills in the
registrar's name, IANA id and abuse email where the registry left them empty. The registry's dates
and statuses always stand, and a registrar server that fails leaves the registry's answer as it
was.

## Decide what a lookup means

A lookup ends one of three ways, and each needs a different next step. A success replaces what
you stored. `not-found` and `unsupported-tld` answer about the name: the registry holds no such
domain, or the TLD runs no RDAP service, and asking again tomorrow will give the same answer.
Everything else is an outage, and an outage should never erase a date you already have:

```typescript {% title="app/domains/expiry.ts" %}
import type { RDAP, RDAPError } from "@sdxc/rdap";
import type { Result } from "@sdxc/result";

import { createBackoff } from "@sdxc/backoff";
import { isSuccess } from "@sdxc/result";

const DAY_MS = 86_400_000;

const RETRY = createBackoff({ base: "1 hour", max: "1 day", jitter: 0.1 });

const ABOUT_THE_NAME = new Set<RDAPError["code"]>(["not-found", "unsupported-tld"]);

export type ExpiryStatus =
	"valid" | "expiring" | "expired" | "unknown" | "unavailable";

export interface ExpiryState {
	expiresAt: number | null;
	eppStatuses: string[];
	warningDays: number;
	failures: number;
}

export interface ExpiryPatch {
	status: ExpiryStatus;
	expiresAt: number | null;
	eppStatuses: string[];
	failures: number;
	error: RDAPError["code"] | null;
	nextCheckAt: number;
}

export function classify(expiresAt: number | null, warningDays: number, now: number) {
	if (expiresAt === null) return "unknown";
	if (expiresAt <= now) return "expired";
	if (expiresAt - now <= warningDays * DAY_MS) return "expiring";
	return "valid";
}

export function expiryOutcome(
	state: ExpiryState,
	lookup: Result<RDAP.Domain, RDAPError>,
	now: number,
): ExpiryPatch {
	if (isSuccess(lookup)) {
		let { expiresAt, status } = lookup.data;
		return {
			status: classify(expiresAt, state.warningDays, now),
			expiresAt,
			eppStatuses: status,
			failures: 0,
			error: null,
			nextCheckAt: now + DAY_MS,
		};
	}

	let { code, retryAfter } = lookup.error;
	if (ABOUT_THE_NAME.has(code)) {
		return {
			status: "unavailable",
			expiresAt: state.expiresAt,
			eppStatuses: state.eppStatuses,
			failures: 0,
			error: code,
			nextCheckAt: now + 7 * DAY_MS,
		};
	}

	let failures = state.failures + 1;
	return {
		status: classify(state.expiresAt, state.warningDays, now),
		expiresAt: state.expiresAt,
		eppStatuses: state.eppStatuses,
		failures,
		error: code,
		nextCheckAt: Math.max(RETRY.at(failures, now), now + (retryAfter ?? 0)),
	};
}
```

A failed lookup classifies the stored date again, so a domain inside its warning window keeps
reporting `expiring` while its registry is down. The retry starts an hour out and grows to a day,
and a `rate-limited` failure carries the registry's `Retry-After` in `retryAfter`, which wins when
it is longer. An unavailable name is asked about again a week later, in case its TLD gains an
RDAP service.

Every `RDAPError` carries a `code` and a `retryable` flag. `rate-limited`, `server-error`,
`timeout`, `network` and `bootstrap-unavailable` are retryable. `invalid-response`, `too-large`
and `refused` are not, though a registry that answers garbage today may be fixed tomorrow, which
is why the backoff above treats every outage alike and caps at a day.

## Alert before it lapses

The expiry date is one signal and the status is the other. `redemptionPeriod` and
`pendingDelete` mean the registration has lapsed and is on its way out, and `clientHold` and
`serverHold` mean the registry has taken the domain out of DNS, whatever its date says:

```typescript {% title="app/domains/alerts.ts" %}
import type { RDAP } from "@sdxc/rdap";

import type { ExpiryPatch } from "~/app/domains/expiry";

const DAY_MS = 86_400_000;

const STOPS_RESOLVING = new Set<RDAP.Status>([
	"redemptionPeriod",
	"pendingDelete",
	"clientHold",
	"serverHold",
]);

const REMIND_AT_DAYS = new Set([30, 14, 7, 1]);

export function needsAlert(patch: ExpiryPatch, now: number) {
	if (patch.eppStatuses.some((status) => STOPS_RESOLVING.has(status))) return true;
	if (patch.status === "expired") return true;
	if (patch.status !== "expiring" || patch.expiresAt === null) return false;
	return REMIND_AT_DAYS.has(Math.ceil((patch.expiresAt - now) / DAY_MS));
}
```

`EPP_STATUSES` lists every status the package names, for a settings page that lets people pick
their own. A status outside it is kept as the registry wrote it, so a registry's own extension
still reaches your code. A retry inside the same day can reach the same reminder twice, so store
the day you last alerted beside the domain and skip a second alert on it.

## Sweep on a schedule

Registries rate-limit without documenting the limits, and a sweep that sends a hundred `.com`
lookups at once finds Verisign's. The sweep groups its domains by registry with `rdap.server`,
runs each group two at a time, and lets different registries run side by side. The bootstrap
file is read once per client, so the grouping costs no extra requests.

Declare the job with an hourly trigger. Each domain is looked up once a day, and the hourly tick
is what lets a retry come back in an hour rather than a day:

```typescript {% title="app/jobs/index.ts" %}
import { job, jobs } from "@sdxc/jobs";

export default jobs({
	sweepDomainExpiry: job({ cron: "0 * * * *" }),
});
```

The handler claims the domains whose `nextCheckAt` has passed and writes each outcome back:

```typescript {% title="app/jobs/sweep-domain-expiry.ts" %}
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import type { TrackedDomain } from "~/app/data/domains";

import { Domains } from "~/app/data/domains";
import { needsAlert } from "~/app/domains/alerts";
import { expiryOutcome } from "~/app/domains/expiry";
import { rdap } from "~/app/domains/rdap";
import jobs from "~/app/jobs";

const PER_REGISTRY = 2;

export default createJobHandler(jobs.sweepDomainExpiry, async (ctx) => {
	let due = await Domains.due(ctx.database, Date.now(), 200);

	let groups = new Map<string, TrackedDomain[]>();
	for (let domain of due) {
		let server = await rdap.server(domain.name);
		let key =
			isFailure(server) || server.data === null ? "none" : server.data.host;
		groups.set(key, [...(groups.get(key) ?? []), domain]);
	}

	let alerts = 0;
	async function check(domain: TrackedDomain) {
		let now = Date.now();
		let patch = expiryOutcome(domain, await rdap.domain(domain.name), now);
		await Domains.recordExpiry(ctx.database, domain.id, patch);
		if (needsAlert(patch, now)) {
			await Domains.alertExpiry(ctx.database, domain.id, patch);
			alerts += 1;
		}
	}

	await Promise.all(
		[...groups.values()].map((group) => inTurns(group, PER_REGISTRY, check)),
	);
	ctx.log.set({ expiry: { checked: due.length, registries: groups.size, alerts } });
});

async function inTurns<T>(items: T[], size: number, run: (item: T) => Promise<void>) {
	for (let start = 0; start < items.length; start += size) {
		await Promise.all(items.slice(start, start + size).map(run));
	}
}
```

`Domains` is your own table: `due` returns up to 200 rows whose `nextCheckAt` has passed, each a
`TrackedDomain` holding its `id`, `name` and the `ExpiryState` fields, and `recordExpiry` writes a
patch to its row. A new row starts with `nextCheckAt` at zero, so the next tick looks it up.
`alertExpiry` is where the notification goes out, by email or to a chat channel. The limit keeps
one tick inside the dispatcher's timeout, and whatever is left over waits for the next tick.

Map the handler on the dispatcher and add `0 * * * *` to the Worker's cron triggers, as
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) sets up. `ctx.database`
is the job middleware from that guide.

## Test the decisions

`expiryOutcome` takes a `Result` and a time, so the outage rules are tested without a registry.
An `RDAPError` is built with the code and the fields that code fills:

```typescript {% title="app/domains/expiry.test.ts" %}
import { RDAPError } from "@sdxc/rdap";
import { failure } from "@sdxc/result";
import { expect, test } from "vitest";

import { expiryOutcome } from "~/app/domains/expiry";

const NOW = Date.UTC(2026, 9, 8);
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

test("an outage keeps a date inside the warning window expiring", () => {
	let state = {
		expiresAt: NOW + 5 * DAY_MS,
		eppStatuses: [],
		warningDays: 30,
		failures: 0,
	};
	let lookup = failure(
		new RDAPError("rate-limited", "Too many requests", {
			url: "https://rdap.verisign.com/com/v1/domain/example.com",
			retryAfter: 2 * HOUR_MS,
		}),
	);

	expect(expiryOutcome(state, lookup, NOW)).toMatchObject({
		status: "expiring",
		expiresAt: NOW + 5 * DAY_MS,
		failures: 1,
		nextCheckAt: NOW + 2 * HOUR_MS,
	});
});
```

The registry's two hours win over the backoff's first hour. To exercise the client itself, mock
the registry and IANA's bootstrap URL with MSW, as
[Test Workers apps](/docs/operations-and-testing/testing) does for any outbound request.

## Where to go next

- [Import and export DNS zone files](/docs/data-and-background-work/zone-files): the records
  under the domain this guide watches.
- [Custom domains for your customers](/docs/identity-and-security/verify-domains): proving a
  customer owns the domain before you monitor it.
- [Retry on a growing delay](/docs/data-and-background-work/retry-with-backoff): the schedules
  `createBackoff` builds.
- [Send alerts to chat and paging services](/docs/data-and-background-work/messaging): where an
  expiry alert goes out.
- [`@sdxc/rdap`](/api/rdap): every option, field and error code.
