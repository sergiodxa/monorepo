---
title: Stream several files as a ZIP
description: Bundle generated text, CSV streams and stored files into one ZIP download that starts at once, holds one entry in memory at a time, and refuses entry names an unarchiver would write outside its folder.
section:
    title: Data & background work
    order: 6
order: 20
lastUpdated: 2026-10-08
---

Some downloads are several files: an account's data export, a month of reports a client gets as
one attachment, a folder of invoices. Sending them as one ZIP saves the person a click per file
and keeps them together on disk.

This guide builds an account export: the account as JSON, its contacts as a CSV, and every
invoice PDF from an R2 bucket, in one `.zip` that streams while it is written.
[`@sdxc/zip`](/api/zip) writes the archive, [`@sdxc/csv`](/api/csv) writes the spreadsheet as a
stream, and [`@sdxc/http`](/api/http) names the download.

```bash
npm add @sdxc/zip @sdxc/csv @sdxc/result @sdxc/http remix
```

## How the archive is written

A `Zip` takes entries with `add` and writes them, in the order they were added, when its
`stream()` is read. Every entry is stored uncompressed, with its CRC-32 and sizes in the header
in front of it, which is the layout every unarchiver and every streaming reader opens.

That layout decides how sources are read. An entry's header carries its size, so a stream
entry is read whole when the archive reaches it, and its header and bytes go out together.
Memory holds one entry at a time however many the archive has, and a source is read only once
the download reaches it, so the response starts before the last file has been opened.

Stored entries are larger than compressed ones: text such as CSV and JSON takes three to four
times what a DEFLATE archive would. Images, PDFs and other files that are already compressed
cost nothing extra, and those are usually most of an export's bytes.

## Add the entries

An entry's source is a string, written as UTF-8, a `Uint8Array`, or a
`ReadableStream<Uint8Array>`. `streamify` returns exactly that stream, so the contacts go in as
their CSV is written:

```typescript {% title="app/exports/account-archive.ts" %}
import type { Result } from "@sdxc/result";
import type { ZipError } from "@sdxc/zip";
import type { Database } from "remix/data-table";

import { streamify } from "@sdxc/csv";
import { isFailure, success } from "@sdxc/result";
import { Zip } from "@sdxc/zip";

import type { Account } from "~/app/data/accounts";

import { Invoices } from "~/app/data/invoices";
import { contactRows } from "~/app/exports/contact-rows";
import { storedFile } from "~/app/exports/stored-file";

export async function accountArchive(
	db: Database,
	account: Account,
): Promise<Result<Zip, ZipError>> {
	let modified = new Date();
	let zip = new Zip();

	let contacts = streamify(contactRows(db, account.id), {
		columns: [
			{ key: "name", header: "Name" },
			{ key: "email", header: "Email" },
			{ key: "created_at", header: "Added" },
		],
	});

	let added = [
		zip.add("account.json", JSON.stringify(account, null, "\t"), { modified }),
		zip.add("contacts.csv", contacts, { modified }),
	];
	for (let invoice of await Invoices.list(db, account.id)) {
		added.push(
			zip.add(`invoices/${invoice.number}.pdf`, storedFile(invoice.fileKey), {
				modified: invoice.issuedAt,
			}),
		);
	}

	for (let result of added) {
		if (isFailure(result)) return result;
	}
	return success(zip);
}
```

`Account` and `Invoices` are your own data, and `contactRows` is an async generator over the
account's contacts, such as the keyset-paged one in
[Import and export CSV](/docs/data-and-background-work/csv). Folders are part of the name:
`invoices/1042.pdf` opens as a file inside an `invoices` folder.

`modified` is the date an unarchiver shows beside each file. Without it, every entry is dated
1 January 1980, which makes the same entries produce byte-for-byte the same archive: the
choice for a file you hash or cache, and the reason a real export passes the time it was made.
The date is recorded in UTC with two-second precision and has to fall between 1980 and 2107.

## Open stored files when the archive reaches them

An R2 object's body is a stream, but `get` opens it, and an archive of two hundred invoices
would open two hundred objects before the first byte went out. A stream whose `pull` opens the
object defers that to the moment the archive reads it:

```typescript {% title="app/exports/stored-file.ts" %}
import { env } from "cloudflare:workers";

async function openObject(key: string) {
	let object = await env.FILES.get(key);
	return object?.body.getReader();
}

export function storedFile(key: string): ReadableStream<Uint8Array> {
	let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

	return new ReadableStream<Uint8Array>(
		{
			async pull(controller) {
				let opened = reader ?? (await openObject(key));
				if (!opened) return controller.error(new Error(`${key} is missing`));
				reader = opened;

				let chunk = await opened.read();
				if (chunk.done) controller.close();
				else controller.enqueue(chunk.value);
			},
			async cancel(reason) {
				await reader?.cancel(reason);
			},
		},
		{ highWaterMark: 0 },
	);
}
```

`highWaterMark: 0` is what keeps the stream from pulling as soon as it is built: it pulls only
when read. One object is open at a time, which also keeps the export inside the number of
connections a Worker may hold open at once. Every entry is read whole into memory before it is
written, so list a file larger than a Worker holds comfortably as a link in a text entry, and
keep the archive for the files that fit.

## Serve the download

```typescript {% title="app/http/controllers/account/export.ts" %}
import { attachment } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { accountArchive } from "~/app/exports/account-archive";
import routes from "~/routes/web";

export default createAction(routes.account.export, async (ctx) => {
	let archive = await accountArchive(ctx.db, ctx.account);
	if (isFailure(archive)) {
		ctx.log.fail(archive.error, { entry: archive.error.entry ?? null });
		return new Response("The export could not be assembled.", { status: 500 });
	}

	return new Response(archive.data.stream(), {
		headers: {
			"Content-Type": "application/zip",
			"Content-Disposition": attachment(`${ctx.account.slug}-export.zip`),
			"Cache-Control": "no-store",
		},
	});
});
```

`ctx.account` is the signed-in account your auth middleware publishes. `attachment()` writes the
`Content-Disposition` value, with a non-ASCII account name in the filename carried exactly. The
response has no `Content-Length`, since the size is known only once the last entry is read, so
a browser shows the download's progress in bytes received.

## Keep entry names safe to extract

`add` checks a name as it is added, and a refused entry leaves the archive unchanged. It fails
with `invalid-entry` for an empty name, a leading `/`, a backslash, an empty, `.` or `..`
segment, a control character, or a name already in the archive. Those are the names an
unarchiver would write outside the folder it extracts into, or would write over another file.

So a name built from something a person typed, such as an uploaded file's original name, is a
name `add` may refuse. Build it from values you control, like the invoice number above, or
replace the characters it refuses and number repeats before adding. The error's `entry` names
the path it refused, which is what the action logs.

`add` also fails with `too-large` for the 65,536th entry and for bytes past 4 GiB, the limits
of a ZIP written without ZIP64. A comment per entry goes in `options.comment`, up to 64 KiB.

## When a source fails mid-download

A stream source that errors, or yields something other than a `Uint8Array`, fails after the
response has started with a `200`. The archive's output stream errors with a `ZipError` whose
`code` is `source-failed`, whose `entry` names the file, and whose `cause` is the source's own
error, and the connection closes. The archive's directory is written last, so a cut-short file
fails to open, and the person sees a failed download and can retry it.

Cancelling the output, which is what a closed browser tab does, cancels every stream source the
archive has not reached. The CSV generator stops paging and the unread R2 objects are never
opened.

## Build the archive once and store it

`bytes()` writes the whole archive into one `Uint8Array` and answers with a `Result`: the bytes,
or the `ZipError` the stream failed with. Use it where the length has to be known, such as
storing the export in R2 for a link that stays valid for a week, from a background job:

```typescript {% title="app/jobs/store-export.ts" %}
import type { Database } from "remix/data-table";

import { isFailure, success } from "@sdxc/result";
import { env } from "cloudflare:workers";

import type { Account } from "~/app/data/accounts";

import { accountArchive } from "~/app/exports/account-archive";

export async function storeExport(db: Database, account: Account) {
	let archive = await accountArchive(db, account);
	if (isFailure(archive)) return archive;

	let bytes = await archive.data.bytes();
	if (isFailure(bytes)) return bytes;

	let key = `exports/${account.id}/${Date.now()}.zip`;
	await env.FILES.put(key, bytes.data, {
		httpMetadata: { contentType: "application/zip" },
	});
	return success(key);
}
```

The whole archive is in memory at once here, so this suits exports of a size a Worker holds
comfortably. A stream source is read once, so an archive holding one is written by a single
call to `stream()` or `bytes()`.

`crc32` is exported too, for checking a file against the checksum a ZIP, PNG or gzip header
records. Pass the previous value as the second argument to continue across chunks.

## Where to go next

- [Import and export CSV](/docs/data-and-background-work/csv) — the paged generator and the
  formula escaping behind `contacts.csv`.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — running the stored
  export off the request.
- [Offer posts as EPUB ebooks](/docs/content-and-feeds/ebooks) — a format that is a ZIP inside,
  written by the same archive writer.
- [`@sdxc/zip`](/api/zip) — every option and error code.
