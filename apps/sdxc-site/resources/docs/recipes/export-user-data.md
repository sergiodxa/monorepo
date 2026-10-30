---
title: Let users export their data
description: Build an account's export as a ZIP in a background job, keep it in R2, and email the person a link once it is ready.
section:
    title: Recipes
    order: 1.7
order: 9
lastUpdated: 2026-10-25
outcomes:
    - "What guides build a data export, and in what order to follow them"
    - "How one job assembles the archive, stores it and emails its link"
    - "Where a file too large for a Worker goes in the export"
---

At the end of this recipe a person asks for their data, carries on using your app, and gets an
email with a download link once a ZIP of their account, their contacts as a CSV and their stored
files is ready.

```bash
npm add @sdxc/jobs @sdxc/result
```

## Assemble the archive

The archive is what the job builds, so write it first. Follow
[Stream an export](/docs/data-and-background-work/csv#stream-an-export) for the paged
`contactRows` generator, then [Add the entries](/docs/data-and-background-work/zip-downloads#add-the-entries)
and [Open stored files when the archive reaches them](/docs/data-and-background-work/zip-downloads#open-stored-files-when-the-archive-reaches-them)
for `accountArchive`.

## Keep the file in R2

The finished archive outlives the job that wrote it, so it goes in a bucket. Open an
`accountExports()` storage over an `EXPORTS` bucket the way
[Crop it square and store a clean copy](/docs/building-remix-apps/png-avatars#crop-it-square-and-store-a-clean-copy)
opens `avatars()`, and serve `exports/<account id>.zip` to the signed-in account as
[Serve either one](/docs/building-remix-apps/png-avatars#serve-either-one) does.

## Build it in a job

Follow [Send email](/docs/data-and-background-work/send-email) through
[Publish a mailer to requests and jobs](/docs/data-and-background-work/send-email#publish-a-mailer-to-requests-and-jobs)
for an `exports.ready` email whose one prop is the download `url`, and
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) for an `exports.build`
job with an `accountId` input, which the export action enqueues before it redirects. The job
already runs off the request, so it sends the email itself, and a failed send retries the run:

```typescript {% title="app/jobs/exports/build.ts" %}
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import emails from "~/app/emails";
import jobs from "~/app/jobs";
import { accountExports } from "~/app/models/account-exports";
import { Accounts } from "~/app/models/accounts";
import { accountArchive } from "~/app/services/exports/account-archive";
import { SITE_URL } from "~/config/constants";
import routes from "~/routes/web";

export default createJobHandler(jobs.exports.build, async (ctx) => {
	let account = await Accounts.find(ctx.db, ctx.input.accountId);
	if (account === null) return ctx.exit("The account was removed");

	let archive = await accountArchive(ctx.db, account);
	if (isFailure(archive)) return ctx.exit(archive.error.message);

	let bytes = await archive.data.bytes();
	if (isFailure(bytes))
		return ctx.retry({ delay: "5 minutes", cause: bytes.error });

	let file = new File([bytes.data.slice()], `${account.slug}-export.zip`, {
		type: "application/zip",
	});
	await accountExports().set(`exports/${account.id}.zip`, file);

	let url = new URL(routes.account.download.href(), SITE_URL);
	let sent = await ctx.email.send(emails.exports.ready, {
		to: account.email,
		locale: account.locale,
		props: { url: url.href },
	});
	if (isFailure(sent)) return ctx.retry({ cause: sent.error });
});
```

> [!WARNING]
> `bytes()` holds the whole archive in memory to store it, so list files too large for a Worker as
> links in a text entry, as the ZIP guide's warning describes.

## Test it

Test each stage as its guide does:
[Test the archive](/docs/data-and-background-work/zip-downloads#test-the-archive) checks the
archive's bytes, and [Run jobs in a test](/docs/data-and-background-work/jobs-and-cron#run-jobs-in-a-test)
drains the job with the memory transport from
[Test with the memory transport](/docs/data-and-background-work/send-email#test-with-the-memory-transport).

## Where to go next

- [Stream several files as a ZIP](/docs/data-and-background-work/zip-downloads) — what happens
  when a stored file fails while the archive is written.
- [Stream JSON Lines](/docs/data-and-background-work/json-lines) — an export format for records
  with nested data.
- [Logs, traces and timings](/docs/operations-and-testing/observability) — reading the record
  each export run emits.
