# @sdxc/csv

Read and write RFC 4180 CSV, with a streaming writer and formula neutralization.

`parse` reads text into records keyed by the header row, `stringify` writes rows back as one
string, and `streamify` writes them as a UTF-8 byte stream while they arrive. Each is its own
named export, so a module that only reads leaves the writers out of the bundle, and a
namespace import reads `CSV.parse(...)` the way
[`JSON.parse`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse)
does. Where `JSON` throws, every function here returns a `Result`.

The reader returns strings only: CSV has no numbers, dates or nulls, and a guessed type can
lose data (`"007"` read as `7`), so rows are typed by your own schema. The writer takes typed
cells, quotes exactly what [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180) requires, and by
default neutralizes string cells a spreadsheet would run as a formula.

## Installation

```bash
npm add @sdxc/csv
```

Results come from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which is where
`unwrap` and `isFailure` come from. It installs alongside this package.

## Usage

### Write And Read Back

```typescript
import * as CSV from "@sdxc/csv";
import { unwrap } from "@sdxc/result";

let text = unwrap(CSV.stringify([{ name: "Ana", city: "Málaga" }]));
// "name,city\r\nAna,Málaga\r\n"

let rows = unwrap(CSV.parse(text)).rows;
// [{ name: "Ana", city: "Málaga" }]
```

### Read An Upload

```typescript
import { parse } from "@sdxc/csv";
import { isFailure } from "@sdxc/result";

let parsed = parse(await file.text());
if (isFailure(parsed)) {
	return new Response(parsed.error.message, { status: 400 }); // "... at line 12"
}

let records = parsed.data.rows; // Record<string, string>[]
let warnings = parsed.data.warnings; // [{ line, message }]
```

### Write For Excel

```typescript
import { stringify } from "@sdxc/csv";

let result = stringify(rows, {
	columns: [
		{ key: "date", header: "Fecha (UTC)" },
		{ key: "uptime", header: "Disponibilidad %" },
	],
	delimiter: ";",
	bom: true,
});
```

Excel in decimal-comma locales (Spanish, German, French, Italian) splits a `.csv` on `;`,
and it reads the file as UTF-8 only when it starts with a byte order mark.

### Stream A Download

```typescript
import { streamify } from "@sdxc/csv";

let body = streamify(cursor, { columns: [{ key: "date" }, { key: "uptime" }] });

return new Response(body, {
	headers: {
		"Content-Type": "text/csv; charset=utf-8",
		"Content-Disposition": 'attachment; filename="uptime.csv"',
	},
});
```

## API

### `parse(source, options?)`

Reads CSV text and returns `Result<Parsed<Record<string, string>>, CSVParseError>`, or
`Parsed<string[]>` with `header: false`.

- `delimiter`: `","` (default), `";"` or `"\t"`
- `header`: read the first record as keys (default `true`)

Records may end in CRLF, LF or a lone CR. A leading BOM is dropped and blank lines are
skipped. `CSVParseError` carries the 1-based `line` of an unterminated quoted field, text
after a closing quote, a record whose field count differs from the first record's, or a
duplicate header. A bare `"` inside an unquoted field is kept and reported in `warnings`.

### `stringify(rows, options?)`

Writes objects under a header record, or arrays of cells as bare records, and returns
`Result<string, CSVStringifyError>`. Every record ends in CRLF.

- `columns`: `{ key, header? }[]`, the order and header text; the first row's keys otherwise
- `header`: write the header record (default `true`)
- `delimiter`: `","` (default), `";"` or `"\t"`
- `bom`: prefix a UTF-8 BOM (default `false`)
- `escapeFormulas`: prefix `'` to string cells starting with `=`, `+`, `-`, `@`, tab or CR
  (default `true`)

A cell is `string | number | bigint | boolean | Date | null | undefined`. `null` and
`undefined` write an empty field, a `Date` writes ISO 8601 in UTC, and numbers write
`String(value)`. Rows typed by an interface are accepted as they are. `CSVStringifyError`
names the `row` and `column` of a value outside those types, an invalid `Date`, or a number
with no finite value, and has no `row` when the delimiter is unknown.

### `streamify(rows, options)`

Takes the same options as `stringify`, with `columns` required, over an `Iterable` or
`AsyncIterable` of objects, and returns a `ReadableStream<Uint8Array>` holding the text
`stringify` would. The header goes out before the first row is read, rows go out in chunks of
about 16 KB, and cancelling the stream calls the source iterator's `return()`. A bad cell
errors the stream with a `CSVStringifyError`.

### Types

`Cell`, `CellRecord`, `Column`, `Delimiter`, `ParseOptions`, `Parsed`, `ParseWarning`,
`StringifyOptions` and `WriteOptions` are exported at the top level, so a namespace import
reads `CSV.Cell`.

## Pattern: Type Uploaded Rows

Every field arrives as a string, so a check per row turns records into the values your code works with
and rejects the ones that are not.

```typescript
import { parse } from "@sdxc/csv";
import { isFailure } from "@sdxc/result";

interface Monitor {
	name: string;
	url: URL;
	intervalSeconds: number;
}

let parsed = parse(source);
if (isFailure(parsed)) throw parsed.error;

let monitors: Monitor[] = [];
let problems: string[] = [];

for (let [index, row] of parsed.data.rows.entries()) {
	let intervalSeconds = Number(row.interval_seconds);
	if (!row.name || !URL.canParse(row.url) || !Number.isInteger(intervalSeconds)) {
		problems.push(`Row ${index + 2} is incomplete`); // + 1 for the header, + 1 for 1-based
		continue;
	}
	monitors.push({ name: row.name, url: new URL(row.url), intervalSeconds });
}
```

## Pattern: Export Rows From A Database Cursor

`streamify` reads an async iterable, so an export can stream straight from a paged query
without holding every row in memory.

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
```

## Pattern: Read Back What Was Written

`parse(unwrap(stringify(rows)))` returns the rows as strings for every delimiter. Fields
holding the delimiter, quotes, line breaks or edge spaces are quoted, and a record of one empty
field is written as `""` so it reads back as that field instead of a skipped blank line.

```typescript
import { parse, stringify } from "@sdxc/csv";
import { unwrap } from "@sdxc/result";

let rows = [{ note: 'said "hi", then left\r\nearly' }];
let text = unwrap(stringify(rows, { delimiter: "\t" }));

unwrap(parse(text, { delimiter: "\t" })).rows; // [{ note: 'said "hi", then left\r\nearly' }]
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
