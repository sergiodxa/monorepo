---
title: Import a large file
description: Accept a CSV or JSON Lines upload, validate every row in a background job, and save the file only when every row passes, reporting each failed row by its line.
section:
    title: Recipes
    order: 1.7
order: 10
lastUpdated: 2026-10-25
outcomes:
    - "What guides build a background import, and in what order to follow them"
    - "How one job reads a stored upload, validates every row and saves or reports"
    - "Why a file with one bad row saves nothing"
---

At the end of this recipe a person uploads a file and gets their page back at once, while a
background job checks every row against your schema. A clean file is saved whole; a file with
problems saves nothing and lists every failed row by the line number their editor shows.

```bash
npm add @sdxc/jobs
```

## Describe and read a row

Follow [Import an upload row by row](/docs/data-and-background-work/json-lines#import-an-upload-row-by-row)
for `readActivity`, which streams a JSON Lines file and collects every problem with its line. For
CSV, follow [Describe a row](/docs/data-and-background-work/csv#describe-a-row) and
[Parse the file and validate each row](/docs/data-and-background-work/csv#parse-the-file-and-validate-each-row)
for `readContacts`, which reads the whole file as text, so cap a CSV upload at a size a Worker
holds comfortably.

## Store the upload and enqueue the import

The job runs after the request ends, so the upload goes in a bucket first. Validate the file
field as [Accept the upload](/docs/data-and-background-work/csv#accept-the-upload) does, store it
with an `importFiles()` storage over an `UPLOADS` bucket the way
[Crop it square and store a clean copy](/docs/building-remix-apps/png-avatars#crop-it-square-and-store-a-clean-copy)
opens `avatars()`, save an import row your page shows, and enqueue an `imports.run` job with
`importId` and `key` inputs, as [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron)
shows.

## Validate and save in the job

The job validates the whole file before it writes a row, so a person who fixes the reported lines
and uploads again never duplicates the rows that were fine:

```typescript {% title="app/jobs/imports/run.ts" %}
import { createJobHandler } from "@sdxc/jobs";

import jobs from "~/app/jobs";
import { Activity } from "~/app/models/activity";
import { importFiles } from "~/app/models/import-files";
import { Imports } from "~/app/models/imports";
import { readActivity } from "~/app/services/imports/read-activity";

export default createJobHandler(jobs.imports.run, async (ctx) => {
	let file = await importFiles().get(ctx.input.key);
	if (file === null) return ctx.exit("The upload was removed");

	let { events, problems } = await readActivity(file.stream());
	if (problems.length > 0) {
		await Imports.fail(ctx.db, ctx.input.importId, problems);
		return;
	}

	await Activity.insertMany(ctx.db, events);
	await Imports.finish(ctx.db, ctx.input.importId, events.length);
});
```

A CSV upload calls `readContacts(await file.text())` instead and stores `error.problems` from its
failure. `Activity.insertMany` writes every row in one statement, which keeps the import all or
nothing on D1, as the note in [Accept the upload](/docs/data-and-background-work/csv#accept-the-upload)
explains. A file that outgrows one run imports in batches with
[Resume a long import](/docs/data-and-background-work/json-lines#resume-a-long-import).

## Test it

Test each stage as its guide does:
[Test the import](/docs/data-and-background-work/json-lines#test-the-import) feeds a file with a
bad line to the reader, and
[Run jobs in a test](/docs/data-and-background-work/jobs-and-cron#run-jobs-in-a-test) drains the
job against a test database.

## Where to go next

- [Validate forms and route params](/docs/building-remix-apps/forms-and-params) — rendering the
  refusal when the upload itself is missing or the wrong type.
- [Standard Schema validation](/docs/conventions/standard-schema-validation) — write the row's
  schema in whichever library you already use.
- [Let users export their data](/docs/recipes/export-user-data) — the same rows going the other
  way.
