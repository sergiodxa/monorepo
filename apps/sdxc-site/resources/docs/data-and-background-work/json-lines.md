---
title: Stream JSON Lines
description: Export records as a JSON Lines download that streams as it is read, import uploads row by row with errors that name the line, and resume a long import where it stopped.
section:
    title: Data & background work
    order: 7
order: 19
lastUpdated: 2026-10-25
outcomes:
    - "How to export records as a streaming JSON Lines download with `@sdxc/jsonl`"
    - "How to import an upload row by row with errors that name the line"
    - "How to bound what a line may cost and resume a long import"
---

JSON Lines (NDJSON) is one JSON value per line, the format to reach for when records carry
nested data a CSV would flatten or a file is too large to hold in memory. This guide exports an
account's activity events as a download and imports them back with [`@sdxc/jsonl`](/api/jsonl),
whose readers answer a `Result` per line with the line's number.

```bash
npm add @sdxc/http @sdxc/jsonl @sdxc/result remix
```

## Export as a stream

`encode` turns an async iterable of values into a byte stream, pulling one value per line as the
response is read, so memory stays flat however many records the export holds:

```typescript {% title="app/http/controllers/activity/export.ts" %}
import { encode } from "@sdxc/jsonl";
import { attachment } from "@sdxc/http/response";
import { createAction } from "remix/router";

import { activityEvents } from "~/app/models/activity";
import routes from "~/routes/web";

export default createAction(routes.activity.export, (ctx) => {
	let body = encode(activityEvents(ctx.db, ctx.account.id));
	return new Response(body, {
		headers: {
			"Content-Type": "application/jsonl",
			"Content-Disposition": attachment("activity.jsonl"),
			"Cache-Control": "no-store",
		},
	});
});
```

`activityEvents` is your own async generator that reads the table a page at a time, as the
keyset-paged one in [Import and export CSV](/docs/data-and-background-work/csv) does. A value
`JSON.stringify` cannot write errors the stream, so the download fails visibly rather than
arriving cut short.

## Import an upload row by row

`read` takes a byte stream, such as a request body, and yields one `Result` per non-blank line.
With a `schema`, each value is validated as it is read and typed from the schema's output:

```typescript {% title="app/services/imports/activity-event.ts" %}
import * as s from "remix/data-schema";

export const ACTIVITY_EVENT = s.object({
	type: s.enum_(["signed_in", "invited", "exported"]),
	actor: s.string(),
	at: s.string(),
	data: s.optional(s.record(s.string(), s.any())),
});
```

```typescript {% title="app/services/imports/read-activity.ts" %}
import { read } from "@sdxc/jsonl";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";

import { ACTIVITY_EVENT } from "~/app/services/imports/activity-event";

export interface ImportProblem {
	line: number;
	message: string;
}

export async function readActivity(body: ReadableStream<Uint8Array>) {
	let events: s.InferOutput<typeof ACTIVITY_EVENT>[] = [];
	let problems: ImportProblem[] = [];

	for await (let entry of read(body, {
		schema: ACTIVITY_EVENT,
		maxLineBytes: 65_536,
	})) {
		if (isFailure(entry)) {
			problems.push({ line: entry.error.line, message: entry.error.message });
			continue;
		}
		events.push(entry.data.value);
	}

	return { events, problems };
}
```

A line that is not JSON, or that the schema rejects, yields a failure and reading continues, so
one pass collects every problem in the file, each with the line number an editor shows. The
action reads `request.body` straight into `readActivity`, then saves `events` only when
`problems` is empty, so uploading a fixed file cannot duplicate rows.

> [!WARNING]
> Pass `maxLineBytes` on every read of an upload. A line is unbounded until you set it, so one
> enormous line grows the Worker's memory until the isolate runs out. A longer line yields one
> `"line-too-long"` failure and reading stops there.

## Resume a long import

An import of millions of rows outlives a request and a single job's time limit. `skip` drops that
many values before the first one yielded, so a run can pick up after the rows it already saved:

```typescript {% title="app/services/imports/import-batch.ts" %}
import type { Database } from "remix/data-table";

import { read } from "@sdxc/jsonl";
import { isFailure } from "@sdxc/result";

import { Activity } from "~/app/models/activity";
import { ACTIVITY_EVENT } from "~/app/services/imports/activity-event";

const BATCH = 1_000;

export async function importBatch(
	db: Database,
	file: ReadableStream<Uint8Array>,
	cursor: number,
) {
	let saved = 0;
	for await (let entry of read(file, { schema: ACTIVITY_EVENT, skip: cursor })) {
		if (isFailure(entry)) return { cursor: cursor + saved, error: entry.error };
		await Activity.insert(db, entry.data.value);
		saved += 1;
		if (saved === BATCH) return { cursor: cursor + saved, done: false };
	}
	return { cursor: cursor + saved, done: true };
}
```

`skip` counts values rather than lines, so the cursor lands on the same record whatever blank
lines the file holds. A job that calls `importBatch` with the file from storage enqueues itself
again with the new cursor until `done`, as
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) shows.

## Test the import

`readActivity` takes any byte stream, so a test hands it a `Blob`'s stream with one good line,
one that is not JSON and one the schema refuses:

```typescript {% title="app/services/imports/read-activity.test.ts" %}
import { expect, test } from "vitest";

import { readActivity } from "~/app/services/imports/read-activity";

test("keeps the valid events and names the line of each problem", async () => {
	let file = new Blob([
		'{"type":"invited","actor":"ada","at":"2026-10-01T09:00:00Z"}\n',
		"{not json}\n",
		'{"type":"deleted","actor":"ada","at":"2026-10-02T09:00:00Z"}\n',
	]);

	let { events, problems } = await readActivity(file.stream());

	expect(events).toHaveLength(1);
	expect(problems.map((problem) => problem.line)).toEqual([2, 3]);
});
```

To check the download, request `routes.activity.export` through `createWebRouter().fetch(...)`,
as [Test Workers apps](/docs/operations-and-testing/testing) shows.

## Where to go next

- [Import and export CSV](/docs/data-and-background-work/csv) — the same import and export for a
  file people open in a spreadsheet.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — the job a resumable
  import runs in.
- [`@sdxc/jsonl`](/api/jsonl) — every option and error code.
