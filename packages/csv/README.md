# @sdxc/csv

Read and write RFC 4180 CSV, with a streaming writer and formula neutralization.

`parse` reads text into records keyed by the header row, `stringify` writes rows back as one
string, and `streamify` writes them as a UTF-8 byte stream while they arrive. Each is its own
named export, so a module that only reads never loads the writers, and a namespace import
reads `CSV.parse(...)` the way `JSON.parse` does. Every function reports its outcome as a
`Result` from `@sdxc/result` instead of throwing.

The reader returns strings only. CSV has no numbers, dates or nulls, and a guessed type can
lose data (`"007"` read as `7`), so rows are typed by the caller's schema. The writer takes
typed cells, quotes exactly what RFC 4180 requires, and by default neutralizes string cells a
spreadsheet would run as a formula.

## Usage

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
if (isFailure(parsed)) return badRequest(parsed.error.message); // names the line

for (let warning of parsed.data.warnings) log.warn(warning.message, { line: warning.line });
let records = parsed.data.rows; // Record<string, string>[]
```

### Write For A Spreadsheet

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

`delimiter: ";"` is what Excel expects in decimal-comma locales, and `bom: true` makes it read
the file as UTF-8.

### Stream A Download

```typescript
import { streamify } from "@sdxc/csv";
import { attachment, csv } from "@sdxc/http/response";

return csv(streamify(cursor, { columns: [{ key: "date" }, { key: "uptime" }] }), {
	headers: { "Content-Disposition": attachment("uptime.csv") },
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
`AsyncIterable` of objects. It returns a `ReadableStream<Uint8Array>` holding the same text
`stringify` would. The header is sent before the first row is read, rows are sent in chunks
of about 16 KB, and cancelling the stream calls the source iterator's `return()`. A bad cell
errors the stream with a `CSVStringifyError`.

### Types

`Cell`, `CellRecord`, `Column`, `Delimiter`, `ParseOptions`, `Parsed`, `ParseWarning`,
`StringifyOptions` and `WriteOptions` are exported at the top level, so a namespace import
reads `CSV.Cell`.

## Patterns

### Type Rows With A Schema

```typescript
import { parse } from "@sdxc/csv";
import { isFailure } from "@sdxc/result";
import { parseSafe } from "@sdxc/validate";
import * as s from "remix/data-schema";

let MonitorRow = s.object({ name: s.string(), url: s.string() });

let parsed = parse(source);
if (isFailure(parsed)) return parsed;
let monitors = parsed.data.rows.map((row) => parseSafe(MonitorRow, row));
```

### Read Back What Was Written

`parse(unwrap(stringify(rows)))` returns the rows as strings, for every delimiter. Fields
holding the delimiter, quotes, line breaks or edge spaces are quoted, and a record of one empty
field is written as `""`, so it reads back as that field instead of a skipped blank line.

## Related Packages

- [`@sdxc/http`](../http/README.md): `csv()` and `attachment()` serve the output as a download
- [`@sdxc/validate`](../validate/README.md): types the strings `parse` returns
- [`@sdxc/result`](../result/README.md): the `Result` every function returns

## Tips

- Leave `escapeFormulas` on for any file a person opens; turn it off only for files a program
  reads, where a leading `'` would become part of the value.
- Pass numbers as `number` cells so they are not neutralized; `-5` as a string becomes `'-5`.
- Use `bom: true` for files meant for Excel and leave it off for files meant for programs.
