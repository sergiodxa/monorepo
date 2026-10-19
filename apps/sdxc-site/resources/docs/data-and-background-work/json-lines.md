---
title: Stream JSON Lines
description: Export records as a JSON Lines download that streams as it is read, import uploads row by row with errors that name the line, and resume a long import where it stopped.
section:
    title: Data & background work
    order: 7
order: 19
lastUpdated: 2026-10-15
---

JSON Lines is one JSON value per line. It is the format to reach for when records carry
nested data that a CSV would flatten, and when a file is too large to hold in memory: each line
stands alone, so a reader handles one record at a time and a writer never builds the whole file.
The same format goes by NDJSON.

This guide exports an account's activity events as a download and imports them back, with
[`@sdxc/jsonl`](/api/jsonl). Its readers answer a `Result` per line with the line's number, cap
how long a line may be, and resume after the rows an earlier run already handled.

```bash
npm add @sdxc/http @sdxc/jsonl @sdxc/result remix
```

## Export as a stream

`encode` turns an iterable or async iterable of values into a byte stream, pulling one value per
line as the response is read, so memory stays flat however many records the export holds:

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
keyset-paged one in [Import and export CSV](/docs/data-and-background-work/csv) does. Each value
is written with `JSON.stringify` on its own line, so a `Date` arrives as an ISO 8601 string. A
value `JSON.stringify` cannot write, such as a `BigInt` or a cycle, errors the stream with the
line it would have taken, and the download fails visibly rather than arriving cut short. If the
client disconnects, cancelling the stream returns the generator, so no further page is read.

## Import an upload row by row

`read` takes a byte stream, such as a request body, and yields one `Result` per non-blank line.
With a `schema`, which can be any Standard Schema, each value is validated as it is read and
`entry.data.value` is typed from the schema's output:

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
one pass collects every problem in the file. The failure's `code` says which it was:
`"invalid-json"`, or `"invalid-value"` with the schema's `issues` beside it. `line` counts
blank lines too, which the reader otherwise skips, so it is the number an editor shows beside
the row. A `\r\n` ending and a leading byte order mark read the same as their absence.

The action reads `request.body` straight into `readActivity`, so the file is never buffered
whole, then saves `events` or renders `problems`. Save nothing while `problems` holds anything,
so fixing the file and uploading it again cannot duplicate the rows that were fine.

## Bound what a line may cost

`maxLineBytes` caps one line, in encoded bytes. The buffer only ever holds the line being read,
so this cap is what keeps an upload of one enormous line from growing memory without end. A
longer line yields one `"line-too-long"` failure and reading stops there, which makes it always
the last entry `read` yields: the loop above records it and ends on its own.

Set it from the largest record you expect, with room to spare. Cap the body as a whole where it
is accepted, too: `maxLineBytes` bounds memory, while the request's size bounds how long a
single import may run.

## Resume a long import

An import of millions of rows outlives a request and, on a Worker, a single job's time limit.
`skip` drops that many values before the first one yielded, so a run that stops can start over
from the same file and pick up after the rows it already saved:

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
lines the file holds, and the lines after it keep their real line numbers for any error. A job
that calls `importBatch` with the file from storage enqueues itself again with the new cursor
until `done`; returning early from the loop releases the stream without reading the rest.
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) writes that job.

## Copy lines without parsing them

`lines` yields each non-blank line as text with its number, and `encodeLines` writes lines that
are already JSON back out byte for byte. Together they filter or split a file without
re-serializing every record:

```typescript {% title="app/services/exports/only-invites.ts" %}
import { encodeLines, lines } from "@sdxc/jsonl";
import { isSuccess } from "@sdxc/result";

async function* invites(source: ReadableStream<Uint8Array>) {
	for await (let line of lines(source, { maxLineBytes: 65_536 })) {
		if (isSuccess(line) && line.data.text.includes('"type":"invited"')) {
			yield line.data.text;
		}
	}
}

export function onlyInvites(source: ReadableStream<Uint8Array>) {
	return encodeLines(invites(source));
}
```

Bytes are split at `\n` before they are decoded, so a character that straddles two chunks of the
stream decodes once, intact.

## Small files in memory

For a file that fits in memory, `parse` reads every value or answers the first line that is not
JSON, and `stringify` writes values as one string ending in a newline, each in a `Result`:

```typescript {% title="app/services/fixtures.ts" %}
import { parse, stringify } from "@sdxc/jsonl";

let events = parse('{"type":"invited"}\n\n{"type":"signed_in"}\n');
let text = stringify([{ type: "exported" }]);
```

## Where to go next

- [Import and export CSV](/docs/data-and-background-work/csv) — the same import and export for a
  file people open in a spreadsheet.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — the job a resumable
  import runs in.
- [Validate forms and route params](/docs/building-remix-apps/forms-and-params) — the schemas
  `read` checks each line with.
- [`@sdxc/jsonl`](/api/jsonl) — every option and error code.
