---
title: Watch when a domain expires
description: Read a domain's expiry date, status and registrar from its registry over RDAP, sweep every tracked domain on a schedule, and alert before the registration lapses.
section:
    title: Data & background work
    order: 7
order: 16
lastUpdated: 2026-10-25
outcomes:
    - "How to look up a domain's expiry, status and registrar over RDAP with `@sdxc/rdap`"
    - "How to decide what a lookup result means"
    - "How to sweep tracked domains on a schedule and alert before registration lapses"
---

A domain that lapses takes everything on it down at once: the site stops resolving, mail
bounces, and after the redemption period anyone can register the name. Every registry
publishes the date, with the domain's status and registrar, over RDAP: JSON over HTTPS, one
server per registry, found through a bootstrap file IANA maintains.

This guide turns that data into an expiry monitor. [`@sdxc/rdap`](/api/rdap) finds the registry
and looks the domain up, [`@sdxc/cache`](/api/cache) keeps the bootstrap file between requests,
[`@sdxc/jobs`](/api/jobs) runs the lookups on a cron trigger, and
[`@sdxc/backoff`](/api/backoff) spaces out the retries when a registry has a bad hour.

```bash
npm add @sdxc/backoff @sdxc/cache @sdxc/jobs @sdxc/rdap @sdxc/result remix
```

## Build the client

An `RDAP` client is configured once with a cache and a user agent. The cache holds IANA's
bootstrap file, so a lookup costs one request rather than two, and the user agent tells a
registry that rate-limits who to contact:

```typescript {% title="app/initializers/rdap.ts" %}
import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { RDAP } from "@sdxc/rdap";
import { env } from "cloudflare:workers";

export const rdap = new RDAP({
	cache: new WorkerKVCache(env.CACHE),
	userAgent: "ExampleMonitor/1.0 (+https://monitor.example.com)",
});
```

The constructor does no work, so the client is safe to build at module scope.

## Look up a domain

`rdap.domain` answers a `Result`. The name can be Unicode or A-label, with or without a trailing
dot; `Bücher.com.` queries `xn--bcher-kva.com`:

```typescript {% title="app/services/domains/describe.ts" %}
import { isFailure, success } from "@sdxc/result";

import { rdap } from "~/app/initializers/rdap";

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

> [!WARNING]
> Pass the registration, `example.co.uk` and never `www.example.co.uk`. A registry holds records
> for the names registered with it, so a name below one answers `not-found`. An app that already
> knows a zone's apex, from a custom-domain setup or an imported zone file, has the right name.

Dates arrive as epoch milliseconds, `null` when the registry publishes none; some ccTLD
registries publish no expiry at all, so plan for a date that stays unknown. `status` holds EPP
status codes such as `pendingDelete`. `related: true` follows `.com` and `.net` registries to
the registrar's own RDAP server to fill in the registrar's details.

## Decide what a lookup means

A lookup ends one of three ways, and each needs a different next step. A success replaces what
you stored. `not-found` and `unsupported-tld` answer about the name: the registry holds no such
domain, or the TLD runs no RDAP service, and asking again tomorrow will give the same answer.
Everything else is an outage, and an outage should never erase a date you already have:

```typescript {% title="app/services/domains/expiry.ts" %}
import type { RDAP, RDAPError } from "@sdxc/rdap";
import type { Result } from "@sdxc/result";

import { createBackoff } from "@sdxc/backoff";
import { isSuccess } from "@sdxc/result";

const DAY_MS = 86_400_000;

const retryBackoff = createBackoff({ base: "1 hour", max: "1 day", jitter: 0.1 });

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
		nextCheckAt: Math.max(
			retryBackoff.at(failures, now),
			now + (retryAfter ?? 0),
		),
	};
}
```

A failed lookup classifies the stored date again, so a domain inside its warning window keeps
reporting `expiring` while its registry is down. The retry starts an hour out and grows to a day,
unless a `rate-limited` failure's `retryAfter` is longer. An unavailable name is asked about
again a week later.

## Alert before it lapses

The expiry date is one signal and the status is the other. `redemptionPeriod` and
`pendingDelete` mean the registration has lapsed and is on its way out, and `clientHold` and
`serverHold` mean the registry has taken the domain out of DNS, whatever its date says:

```typescript {% title="app/services/domains/alerts.ts" %}
import type { RDAP } from "@sdxc/rdap";

import type { ExpiryPatch } from "~/app/services/domains/expiry";

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

A retry inside the same day can reach the same reminder twice, so store the day you last
alerted beside the domain and skip a second alert on it.

## Sweep on a schedule

> [!WARNING]
> Registries rate-limit without documenting the limits, and a sweep that sends a hundred `.com`
> lookups at once finds Verisign's.

The sweep groups its domains by registry with `rdap.server`, which costs no extra requests, and
runs each group two at a time. Declare the job with an hourly trigger: each domain is looked up
once a day, and the hourly tick lets a retry come back in an hour:

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

import type { TrackedDomain } from "~/app/models/domains";

import { rdap } from "~/app/initializers/rdap";
import jobs from "~/app/jobs";
import { Domains } from "~/app/models/domains";
import { needsAlert } from "~/app/services/domains/alerts";
import { expiryOutcome } from "~/app/services/domains/expiry";

const PER_REGISTRY = 2;

export default createJobHandler(jobs.sweepDomainExpiry, async (ctx) => {
	let due = await Domains.due(ctx.db, Date.now(), 200);

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
		await Domains.recordExpiry(ctx.db, domain.id, patch);
		if (needsAlert(patch, now)) {
			await Domains.alertExpiry(ctx.db, domain.id, patch);
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

`Domains` is your own model: `due` returns up to 200 rows whose `nextCheckAt` has passed, which
keeps one tick inside the dispatcher's timeout, and `alertExpiry` sends the notification by
email or to a chat channel. Map the handler and add `0 * * * *` to the Worker's cron triggers,
as [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) sets up.

## Test the decisions

`expiryOutcome` takes a `Result` and a time, so the outage rules are tested without a registry:

```typescript {% title="app/services/domains/expiry.test.ts" %}
import { RDAPError } from "@sdxc/rdap";
import { failure } from "@sdxc/result";
import { expect, test } from "vitest";

import { expiryOutcome } from "~/app/services/domains/expiry";

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

- [Retry on a growing delay](/docs/data-and-background-work/retry-with-backoff) — the schedules
  `createBackoff` builds.
- [Send alerts to chat and paging services](/docs/data-and-background-work/messaging) — where an
  expiry alert goes out.
- [`@sdxc/rdap`](/api/rdap) — every option, field and error code.
