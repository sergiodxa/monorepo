---
title: Make a job
description: Write a background job with sdxc make job, declared in app/jobs/index.ts and mapped on the dispatcher, or a scheduled one with --cron.
section:
    title: The sdxc command
    order: 2
order: 2.04
lastUpdated: 2026-10-19
outcomes:
    - "How `make job` declares a job and maps it on the dispatcher"
    - "How to schedule one with `--cron`"
    - "How to fill in and test a job handler"
---

A job is work that runs off the request: sending an email, calling a slow API, sweeping expired
rows on a schedule. `sdxc make job` writes the handler in `app/jobs/`, declares the job in
`app/jobs/index.ts` and maps it on the dispatcher, so it runs the first time something enqueues
it:

```bash
sdxc make job reports/daily
```

```text
Wrote app/jobs/reports/daily.ts
Wrote app/jobs/reports/daily.test.ts
Edited app/jobs/index.ts
Edited app/initializers/dispatcher.ts
```

Reach for it whenever a request would otherwise wait on work its visitor does not need to see
finish, or when the work runs on a clock rather than on a request.

## Flags

A job either takes input from whatever enqueues it, or runs on a schedule with no input;
`--cron` writes the second kind.

| Flag                  | Default      | What it does                                      |
| --------------------- | ------------ | ------------------------------------------------- |
| `--cron <expression>` |              | declare a scheduled job instead of one with input |
| `--test`, `--no-test` | `make.tests` | write the test beside it, or skip it              |
| `--dry-run`           |              | print the files and the diffs, and change nothing |

```bash
sdxc make job digest --cron "0 8 * * *"
```

## What it writes

The handler logs the job's name on the invocation's log and leaves the work to you:

```typescript {% title="app/jobs/reports/daily.ts" %}
import { createJobHandler } from "@sdxc/jobs";

import jobs from "~/app/jobs";

export default createJobHandler(jobs.reports.daily, async (ctx) => {
	ctx.log.set({ job: { name: "daily" } });
	// TODO: do the work, through the services on `ctx`
});
```

A `--cron` job is written from `job.cron.stub`, the same handler for a job each run of the
schedule enqueues.

## What it edits

The job is declared in `app/jobs/index.ts` with an empty input schema, and mapped on the
dispatcher the initializer in `app/initializers/` creates with `createJobDispatcher`:

```text
--- a/app/jobs/index.ts
+++ b/app/jobs/index.ts
-import { jobs } from "@sdxc/jobs";
+import { jobs, job } from "@sdxc/jobs";
+import * as s from "remix/data-schema";

-export default jobs({});
+export default jobs({
+	reports: {
+		daily: job({ input: s.object({}) }),
+	},
+});
--- a/app/initializers/dispatcher.ts
+++ b/app/initializers/dispatcher.ts
+import jobs from "~/app/jobs";
@@
+dispatcher.map(jobs.reports.daily, () => import("~/app/jobs/reports/daily"));
```

With `--cron`, the declaration carries the schedule instead of an input:

```typescript
digest: job({ cron: "0 8 * * *" }),
```

Cloudflare fires a schedule the Worker declares, so add the same expression to the Worker's
triggers in `cloudflare.config.ts`:

```typescript {% title="cloudflare.config.ts" %}
triggers: [triggers.queue({ name: manifest.name }), triggers.scheduled({ schedule: "0 8 * * *" })],
```

## Names and keys

The key is the file's last segment in camelCase, and each folder is a group:
`reports/send-summary` is `jobs.reports.sendSummary`, in `app/jobs/reports/send-summary.ts`. A
folder whose jobs are already mapped under a group of another spelling joins that group, so a
new job in `app/jobs/activitypub/` lands beside its siblings under `activityPub`. The key is the
job's name on the queue, so rename it only when no message under the old name is waiting.

## The test

```typescript {% title="app/jobs/reports/daily.test.ts" %}
import { describe, expect, test } from "vitest";

import handler from "~/app/jobs/reports/daily";

describe("daily", () => {
	test("exports the handler the dispatcher maps", () => {
		expect(handler).toBeDefined();
	});

	test.todo("does the Daily work");
});
```

```bash
bun run test app/jobs/reports/daily.test.ts
```

Turn the `test.todo` into a run through the dispatcher once the job does its work.

## Fill it in

1. Describe the job's input in `app/jobs/index.ts`, replacing `s.object({})` with the fields a
   caller sends, such as `s.object({ postId: s.string() })`. The handler's `ctx.input` takes that
   type.
2. Do the work through what the dispatcher's middleware publishes: `ctx.db`, `ctx.models` and
   `ctx.log` in the template.
3. Enqueue it from a controller with `ctx.jobs.enqueue(jobs.reports.daily, input)`, once
   `jobEnqueuer(queue)` from `@sdxc/jobs/router` is in the router's chain, or from a job handler
   or a test with `dispatcher.enqueue`.

[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) covers enqueuing,
retries, timeouts and schedules, and [`@sdxc/jobs`](/api/jobs) the whole API.

## Where to go next

- [Make a service](/docs/sdxc/make-service) — the rule a job carries out, kept apart so a
  controller or a command can call it too.
- [Make an email](/docs/sdxc/make-email) — the message a job sends.
- [Generate files](/docs/sdxc/generate-files) — the flags, configuration and stubs every kind
  shares.
