# @sdxc/csv

Read and write RFC 4180 CSV, with a streaming writer and formula neutralization.

`parse` reads text into records, `stringify` writes rows as one string, and `streamify` writes
them as a UTF-8 byte stream. A namespace import reads `CSV.parse(...)` like
[`JSON.parse`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse),
and every function returns a `Result` where `JSON` would throw.

## Installation

```sh
npm add @sdxc/csv
```

Results come from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs
alongside it and provides `unwrap` and `isFailure`.

## Usage

### Write and read back

```typescript
import * as CSV from "@sdxc/csv";
import { unwrap } from "@sdxc/result";

let text = unwrap(CSV.stringify([{ name: "Ana", city: "Málaga" }]));
// "name,city\r\nAna,Málaga\r\n"

let rows = unwrap(CSV.parse(text)).rows;
// [{ name: "Ana", city: "Málaga" }]
```

### Read an upload

```typescript
import { parse } from "@sdxc/csv";
import { isFailure } from "@sdxc/result";

let parsed = parse(await file.text());
if (isFailure(parsed)) {
	return new Response(parsed.error.message, { status: 400 }); // "Expected 3 fields, found 2 at line 12"
}

parsed.data.rows; // Record<string, string>[]
parsed.data.warnings; // [{ line, message }]
```

Every field reads as a string: CSV has no numbers, dates or nulls, so your own code types the rows.

### Choose columns and write typed cells

```typescript
import { stringify } from "@sdxc/csv";

let result = stringify(
	[{ id: 1n, createdAt: new Date("2026-10-12T09:30:00Z"), total: 19.5, note: null }],
	{
		columns: [
			{ key: "id", header: "Order" },
			{ key: "createdAt", header: "Created (UTC)" },
			{ key: "total" },
			{ key: "note" },
		],
	},
);
// "Order,Created (UTC),total,note\r\n1,2026-10-12T09:30:00.000Z,19.5,\r\n"
```

`columns` sets the order and header text; without it the first row's keys are the columns.

### Stream a download

```typescript
import { streamify } from "@sdxc/csv";

let body = streamify(rows, { columns: [{ key: "date" }, { key: "visits" }] });

return new Response(body, {
	headers: {
		"Content-Type": "text/csv; charset=utf-8",
		"Content-Disposition": 'attachment; filename="visits.csv"',
	},
});
```

## API

### `parse(source: string, options?: ParseOptions)`

Returns `Result<Parsed<Record<string, string>>, CSVParseError>`, or `Parsed<string[]>` with
`header: false`. Records may end in CRLF, LF or CR; a leading BOM is dropped, blank lines are
skipped, and a bare `"` inside an unquoted field is kept and reported in `warnings`.

- `delimiter`: `","` (default), `";"` or `"\t"`
- `header`: read the first record as keys (default `true`)

### `stringify(rows, options?: StringifyOptions)`

Writes objects under a header record, or arrays of cells as bare records, and returns
`Result<string, CSVStringifyError>`. Fields holding the delimiter, a quote, a line break or edge
spaces are quoted, and every record ends in CRLF.

- `columns`: `{ key, header? }[]`, the order and header text; the first row's keys otherwise
- `header`: write the header record (default `true`)
- `delimiter`: `","` (default), `";"` or `"\t"`
- `bom`: prefix a UTF-8 BOM, which Excel needs to read the file as UTF-8 (default `false`)
- `escapeFormulas`: prefix `'` to string cells starting with `=`, `+`, `-`, `@`, tab or CR, so a
  spreadsheet shows them as text (default `true`)

### `streamify(rows, options: StringifyOptions & { columns })`

Writes an `Iterable` or `AsyncIterable` of objects as a `ReadableStream<Uint8Array>` holding the
text `stringify` would. The header goes out before the first row is read, rows go out in chunks of
about 16 KB, cancelling stops the source iterator, and a bad cell errors the stream with a
`CSVStringifyError`.

### `CSVParseError`

Carries the 1-based `line` of an unterminated quoted field, text after a closing quote, a record
whose field count differs from the first record's, or a duplicate header.

### `CSVStringifyError`

Carries the `row` index and `column` of a value outside the cell types, an invalid `Date` or a
non-finite number; `row` is absent when the delimiter is unknown.

### Types

`Cell` is `string | number | bigint | boolean | Date | null | undefined`: `null` and `undefined`
write an empty field and a `Date` writes ISO 8601 in UTC. `CellRecord<Row>` accepts rows typed by
an interface, `Column<Row>` is one `{ key, header? }`, and `Delimiter` is `"," | ";" | "\t"`.
`ParseOptions`, `Parsed<T>` (`rows` and `warnings`), `ParseWarning` (`line` and `message`),
`WriteOptions` and `StringifyOptions<Row>` name the options and results above.

## Pattern: Type Uploaded Rows

A check per row turns string records into the values your code works with and collects the rows
it rejects.

```typescript
import { parse } from "@sdxc/csv";
import { isFailure } from "@sdxc/result";

interface Subscriber {
	email: string;
	website: URL;
	seats: number;
}

let parsed = parse(source);
if (isFailure(parsed)) throw parsed.error;

let subscribers: Subscriber[] = [];
let problems: string[] = [];

for (let [index, row] of parsed.data.rows.entries()) {
	let seats = Number(row.seats);
	if (!row.email || !URL.canParse(row.website) || !Number.isInteger(seats)) {
		problems.push(`Row ${index + 2} is incomplete`); // the header is line 1
		continue;
	}
	subscribers.push({ email: row.email, website: new URL(row.website), seats });
}
```

## Pattern: Export From A Paged Query

`streamify` reads an async iterable, so an export streams straight from a paged query while
holding one page in memory.

```typescript
import { streamify } from "@sdxc/csv";

async function* orders(db: Database) {
	let cursor: string | undefined;
	do {
		let page = await db.orders.list({ after: cursor, limit: 500 });
		yield* page.rows;
		cursor = page.next;
	} while (cursor);
}

let body = streamify(orders(db), {
	columns: [
		{ key: "id", header: "Order" },
		{ key: "placedAt", header: "Placed at" },
		{ key: "total", header: "Total" },
	],
});

return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8" } });
```

## Pattern: A File Excel Opens Correctly

Excel in decimal-comma locales (Spanish, German, French, Italian) splits a `.csv` on `;`, and
reads it as UTF-8 only when it starts with a BOM. Formula neutralization stays on, so a cell like
`=HYPERLINK(...)` from user input shows as text.

```typescript
import { stringify } from "@sdxc/csv";
import { unwrap } from "@sdxc/result";

let text = unwrap(
	stringify(rows, {
		columns: [
			{ key: "date", header: "Fecha (UTC)" },
			{ key: "name", header: "Nombre" },
		],
		delimiter: ";",
		bom: true,
	}),
);
```

## Pattern: Headerless Records And TSV

With `header: false` the reader returns arrays of fields, and the writer takes arrays of cells.

```typescript
import { parse, stringify } from "@sdxc/csv";
import { unwrap } from "@sdxc/result";

let records = unwrap(parse("a\t1\r\nb\t2", { header: false, delimiter: "\t" })).rows;
// [["a", "1"], ["b", "2"]]

let tsv = unwrap(
	stringify(
		[
			["c", 3],
			["d", null],
		],
		{ delimiter: "\t" },
	),
);
// "c\t3\r\nd\t\r\n"
```

## Pattern: Exchange Data Between Programs

For a file another program reads rather than a spreadsheet, turn formula neutralization off and
`parse` returns exactly the strings `stringify` wrote, quotes and line breaks included.

```typescript
import { parse, stringify } from "@sdxc/csv";
import { unwrap } from "@sdxc/result";

let rows = [{ note: 'said "hi", then left\r\nearly', delta: "-5" }];
let text = unwrap(stringify(rows, { escapeFormulas: false }));

unwrap(parse(text)).rows; // [{ note: 'said "hi", then left\r\nearly', delta: "-5" }]
```

## Pattern: Report Errors To The Caller

Both errors locate the problem: `line` for the reader, `row` and `column` for the writer.

```typescript
import { CSVParseError, CSVStringifyError, parse, stringify } from "@sdxc/csv";
import { isFailure } from "@sdxc/result";

let parsed = parse('a,b\r\n1,"open');
if (isFailure(parsed)) {
	parsed.error instanceof CSVParseError; // true
	parsed.error.line; // 2
}

let written = stringify([{ total: Number.NaN }]);
if (isFailure(written)) {
	written.error instanceof CSVStringifyError; // true
	[written.error.row, written.error.column]; // [0, "total"]
}
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/csv": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
