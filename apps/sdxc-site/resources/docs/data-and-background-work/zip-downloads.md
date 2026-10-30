---
title: Stream several files as a ZIP
description: Bundle generated text, CSV streams and stored files into one ZIP download that starts at once, holds one entry in memory at a time, and refuses entry names an unarchiver would write outside its folder.
section:
    title: Data & background work
    order: 7
order: 17
lastUpdated: 2026-10-25
outcomes:
    - "How to bundle text, CSV streams and stored files into one ZIP with `@sdxc/zip`"
    - "How to serve a download that starts at once and holds one entry in memory"
    - "How to keep entry names safe to extract and handle a source failing mid-download"
---

Some downloads are several files: an account's data export, a month of reports a client gets as
one attachment, a folder of invoices. Sending them as one ZIP saves the person a click per file
and keeps them together on disk.

This guide builds an account export: the account as JSON, its contacts as a CSV, and every
invoice PDF from an R2 bucket, in one `.zip` that streams while it is written.
[`@sdxc/zip`](/api/zip) writes the archive, [`@sdxc/csv`](/api/csv) writes the spreadsheet as a
stream, and [`@sdxc/http`](/api/http) names the download.

```bash
npm add @sdxc/csv @sdxc/http @sdxc/result @sdxc/zip remix
```

## Add the entries

A `Zip` takes entries with `add` and writes them, in order, when its `stream()` is read. Each
entry is stored uncompressed and read whole when the archive reaches it, so memory holds one
entry at a time and the response starts before the last file has been opened. Text takes three
to four times the space a compressed archive would; PDFs and images, usually most of an
export's bytes, cost nothing extra.

An entry's source is a string, written as UTF-8, a `Uint8Array`, or a
`ReadableStream<Uint8Array>`. `streamify` returns exactly that stream, so the contacts go in as
their CSV is written:

```typescript {% title="app/services/exports/account-archive.ts" %}
import type { Result } from "@sdxc/result";
import type { ZipError } from "@sdxc/zip";
import type { Database } from "remix/data-table";

import { streamify } from "@sdxc/csv";
import { isFailure, success } from "@sdxc/result";
import { Zip } from "@sdxc/zip";

import type { Account } from "~/app/models/accounts";

import { Invoices } from "~/app/models/invoices";
import { contactRows } from "~/app/services/exports/contact-rows";
import { storedFile } from "~/app/services/exports/stored-file";

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

`modified` is the date an unarchiver shows beside each file; without it, every entry is dated
1 January 1980.

## Open stored files when the archive reaches them

An R2 object's body is a stream, but `get` opens it, and an archive of two hundred invoices
would open two hundred objects before the first byte went out. A stream whose `pull` opens the
object defers that to the moment the archive reads it:

```typescript {% title="app/services/exports/stored-file.ts" %}
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

`highWaterMark: 0` keeps the stream from pulling until it is read, so one object is open at a
time, inside the number of connections a Worker may hold open at once.

> [!WARNING]
> Every entry is read whole into memory before it is written, so list a file larger than a Worker
> holds comfortably as a link in a text entry, and keep the archive for the files that fit.

## Serve the download

The action returns the archive's stream as the response body, so the first entry goes out while
the rest are still unread. Assembling fails only on a refused entry, before anything is sent:

```typescript {% title="app/http/controllers/account/export.ts" %}
import { file } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { accountArchive } from "~/app/services/exports/account-archive";
import routes from "~/routes/web";

export default createAction(routes.account.export, async (ctx) => {
	let archive = await accountArchive(ctx.db, ctx.account);
	if (isFailure(archive)) {
		ctx.log.fail(archive.error, { entry: archive.error.entry ?? null });
		return new Response("The export could not be assembled.", { status: 500 });
	}

	return file(archive.data.stream(), `${ctx.account.slug}-export.zip`, {
		headers: { "Content-Type": "application/zip", "Cache-Control": "no-store" },
	});
});
```

`ctx.account` is the signed-in account your auth middleware publishes, and `file()` writes the
`Content-Disposition` header. The response has no `Content-Length`, since the size is known only
once the last entry is read.

## Keep entry names safe to extract

`add` fails with `invalid-entry` for any name an unarchiver would write outside the folder it
extracts into, or over another file: a leading `/`, a backslash, a `..` segment, a control
character or a repeated name. The error's `entry` names the path it refused, which is what the
action logs.

> [!WARNING]
> A name built from something a person typed, such as an uploaded file's original name, is a name
> `add` may refuse. Build it from values you control, like the invoice number above, or replace
> the characters it refuses and number repeats before adding.

## When a source fails mid-download

A stream source that errors fails after the response has started with a `200`: the output
errors with a `source-failed` `ZipError` naming the entry, and the connection closes. The
archive's directory is written last, so a cut-short file fails to open and the person retries
the download. A closed browser tab cancels every source the archive has not reached.

## Test the archive

`bytes()` writes the whole archive into one `Uint8Array` and answers a `Result`, so a test reads
the outcome without serving a response; entries are uncompressed, so a file's text is readable
in the bytes. Give the `cloudflare:workers` stand-in a `FILES: createR2Bucket()`
binding from `@sdxc/cloudflare-mocks`, as
[Test Workers apps](/docs/operations-and-testing/testing) sets up, and the test writes the
object it reads:

```typescript {% title="app/services/exports/stored-file.test.ts" %}
import { isFailure, unwrap } from "@sdxc/result";
import { Zip } from "@sdxc/zip";
import { env } from "cloudflare:workers";
import { expect, test } from "vitest";

import { storedFile } from "~/app/services/exports/stored-file";

test("writes a stored invoice into the archive", async () => {
	await env.FILES.put("invoices/1042.pdf", "%PDF-1.7 invoice 1042");
	let zip = new Zip();
	unwrap(zip.add("invoices/1042.pdf", storedFile("invoices/1042.pdf")));

	let bytes = unwrap(await zip.bytes());

	expect(new TextDecoder().decode(bytes)).toContain("invoice 1042");
});

test("names the entry whose stored file is missing", async () => {
	let zip = new Zip();
	unwrap(zip.add("invoices/404.pdf", storedFile("invoices/404.pdf")));

	let bytes = await zip.bytes();

	expect(isFailure(bytes) && bytes.error.code).toBe("source-failed");
	expect(isFailure(bytes) && bytes.error.entry).toBe("invoices/404.pdf");
});
```

## Where to go next

- [Import and export CSV](/docs/data-and-background-work/csv) — the paged generator and the
  formula escaping behind `contacts.csv`.
- [Offer posts as EPUB ebooks](/docs/content-and-feeds/ebooks) — a format that is a ZIP inside,
  written by the same archive writer.
- [`@sdxc/zip`](/api/zip) — every option, limit and error code.
