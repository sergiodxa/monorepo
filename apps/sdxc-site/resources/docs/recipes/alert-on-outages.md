---
title: Get paged when a dependency is down
description: Poll the health reports of the services your app depends on from a cron job, and alert chat and a paging service when one goes down and again when it recovers.
section:
    title: Recipes
    order: 1.7
order: 13
lastUpdated: 2026-10-25
outcomes:
    - "What guides build outage alerts, and in what order to follow them"
    - "How a scheduled job turns health reports into one alert per outage"
    - "When a failed alert is sent again"
---

By the end of this recipe a job checks the services your app depends on every five minutes,
posts to Slack and pages through PagerDuty when one starts failing, and resolves the incident
when it answers again. Each change of state alerts once, so a long outage never floods the
channel.

```bash
npm add @sdxc/jobs @sdxc/messaging @sdxc/result
```

## Read each dependency's health

Follow [Dependency health checks](/docs/operations-and-testing/health-checks) for the report
your own services answer, and
[Read another service's report](/docs/operations-and-testing/health-checks#read-another-service-s-report)
for the `readStatus` function the job calls.

## Connect chat and paging

Follow [Send alerts to chat and paging services](/docs/data-and-background-work/messaging)
through [Deliver from a job](/docs/data-and-background-work/messaging#deliver-from-a-job), so
every job reads `ctx.destinations`.

## Check on a schedule

Follow [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) for the queue,
the dispatcher and the Worker's `scheduled` handler, then write the job with
`sdxc make job check-dependencies --cron "*/5 * * * *"`. The handler compares each status with
the one stored last time, and sends only on a change:

```typescript {% title="app/jobs/check-dependencies.ts" %}
import type { Message } from "@sdxc/messaging";

import type { ChannelConfig } from "~/app/services/notifications/destinations";

import { createJobHandler } from "@sdxc/jobs";
import { isFailure, isSuccess, wrap } from "@sdxc/result";
import { env } from "cloudflare:workers";

import jobs from "~/app/jobs";
import { Dependencies } from "~/app/models/dependencies";
import { readStatus } from "~/app/services/dependencies";

const DEPENDENCIES = {
	payments: "https://api.payments.example.com/healthz",
	search: "https://search.example.com/health",
};

const CHANNELS: ChannelConfig[] = [
	{ kind: "slack", url: env.SLACK_ALERTS_URL },
	{ kind: "pagerduty", routingKey: env.PAGERDUTY_ROUTING_KEY },
];

export default createJobHandler(jobs.checkDependencies, async (ctx) => {
	for (let [name, url] of Object.entries(DEPENDENCIES)) {
		let read = await wrap(() => readStatus(url));
		let down =
			isFailure(read) || isFailure(read.data) || read.data.data === "fail";
		if (down === (await Dependencies.isDown(ctx.db, name))) continue;

		let key = `health:${name}`;
		let alert: Message = down
			? { title: `${name} is down`, severity: "critical", key }
			: {
					title: `${name} recovered`,
					severity: "success",
					key,
					state: "resolved",
				};
		let sends = await Promise.all(
			CHANNELS.map((config) => ctx.destinations(config).send(alert)),
		);
		if (sends.every(isSuccess)) await Dependencies.recordDown(ctx.db, name, down);
	}
});
```

`wrap` turns a request that never gets an answer into a failure, which counts as down.
`Dependencies` is your own model, storing whether each dependency was down at the last check. A
change is recorded once every channel took the alert, so a failed send is tried again on the
next tick, and the shared `key` lets PagerDuty resolve the incident the failure opened.

## Test it

Test each stage as its guide does:
[Test the report](/docs/operations-and-testing/health-checks#test-the-report) answers a failing
dependency with MSW, and
[Test the delivery job](/docs/data-and-background-work/messaging#test-the-delivery-job) records
the alerts on a `MemoryDestination`.

## Where to go next

- [Fan out by severity](/docs/data-and-background-work/messaging#fan-out-by-severity) — keep
  warnings in chat and page only for critical failures.
- [Logs, traces and timings](/docs/operations-and-testing/observability) — the record each
  check run and each failed send writes.
- [`@sdxc/health`](/api/health) — probe options, timeouts and the report format.
