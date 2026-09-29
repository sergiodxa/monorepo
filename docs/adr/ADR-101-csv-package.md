# ADR-101: CSV Package

## Status

**Accepted** - 2026-09-29

## Background

CSV is the format every spreadsheet opens: Excel, Google Sheets, Numbers and LibreOffice all
read a `.csv` download without an import wizard, and every reporting, CRM and email tool accepts
one. [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180) is the closest thing to a
specification. It documents the common dialect and registers `text/csv`, but real files differ
from it in delimiter, line endings and encoding, depending on which program and locale wrote them.

Nothing in the repo reads or writes CSV today. The first consumer is uptime's report exports
([uptime ADR-032](./uptime/ADR-032-uptime-report-exports.md)), which agencies download and forward to
their clients. Other workspaces may need CSV later: a book's subscriber list moving between email
providers, bulk user administration in the auth server, and monitor imports from other uptime
tools. The format goes in its own package, in line with every other format the repo speaks
(`@sdxc/opml`, `@sdxc/yaml`, `@sdxc/icalendar`, `@sdxc/xml`).

## Context

### What RFC 4180 asks of a writer and a reader

| Rule                                                                            | Consequence for the package                                                              |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Records end in CRLF; the last record may omit it (§2.1-2.2)                     | the writer ends every record in CRLF; the reader accepts CRLF, LF and a lone CR          |
| An optional header record has the same field count as the rest (§2.3)           | records mode reads the first record as keys; a record with a different field count fails |
| Fields containing a comma, a double quote or a line break must be quoted (§2.6) | the writer quotes exactly those fields, plus fields with leading or trailing spaces      |
| A double quote inside a quoted field is written twice (§2.7)                    | escaping happens in one place, both ways                                                 |
| `text/csv` takes `charset` and `header=present\|absent` parameters (§3)         | `@sdxc/http/response`'s `csv` builder sets `text/csv; charset=utf-8`                     |
| Fields hold text; the RFC defines no numbers, dates or nulls                    | the reader returns strings only, and typing belongs to the caller's schema               |

### What real files add

| Behavior in the wild                                                                                              | Consequence                                                                         |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Excel reads a BOM-less `.csv` in the system's legacy code page, so `Café` opens as `CafÃ©`                        | the writer can prepend a UTF-8 BOM; the reader strips one                           |
| Excel in decimal-comma locales (Spanish, German, French, Portuguese, Italian) splits on `;` when opening a `.csv` | `delimiter` is an option for both halves: `,`, `;` or tab                           |
| A cell starting with `=`, `+`, `-`, `@`, tab or CR is run as a formula when the file is opened (CSV injection)    | the writer neutralizes string cells that start with those characters, on by default |
| Hand-edited files carry a bare `"` inside an unquoted field (`5" screen`)                                         | the reader keeps it as a literal character and reports a warning                    |
| Exports can have tens of thousands of rows, and a Worker has 128 MB of memory                                     | the writer also has a streaming form, which encodes rows as they arrive             |

## Decision

Add `@sdxc/csv`: `parse` and `stringify` for RFC 4180 CSV, with a configurable delimiter, a
records mode keyed by the header row, formula neutralization, an optional BOM and a streaming writer.
Serving CSV over HTTP stays in `@sdxc/http/response`, whose `csv` builder learns to take a
stream and whose downloads gain an RFC 8187 filename. Uptime's report exports adopt both first.

### Package name

`@sdxc/csv`. Format packages here are named for the format they speak, and nothing else would
claim the name. TSV is the same grammar with a tab delimiter, so it lives here as an option and
gets no package of its own.

### Scope

The package includes:

- `parse`: records keyed by header (the default) or rows of strings (`header: false`)
- `stringify`: objects written in a declared column order with header labels, or rows of cells
- `streamify`: the same writer over an `Iterable` or `AsyncIterable`, as a
  `ReadableStream<Uint8Array>`

Decisions inside that scope:

- **Strings in, strings out on read.** `parse` returns `Record<string, string>[]` and does no
  number, date or boolean inference. The caller types rows with `remix/data-schema` through
  `@sdxc/validate`, the same way it types a form post. A guessed `"007"` turned into `7` could
  never be recovered.
- **Typed cells on write.** A cell is `string | number | bigint | boolean | Date | null |
undefined`. `null` and `undefined` write an empty field, `Date` writes ISO 8601 in UTC,
  `boolean` writes `true`/`false`, and numbers write `String(value)`. A caller that wants a
  locale's decimal comma or a formatted date passes a string.
- **Formula neutralization applies to string cells only.** A string that starts with `=`, `+`,
  `-`, `@`, tab or CR gets a leading `'`, which spreadsheets show as text. A `number` cell of
  `-5` stays a number, because the writer knows its type. `escapeFormulas: false` turns this off
  for machine-to-machine files.
- **Explicit columns.** `stringify` takes `columns: { key, header }[]`, which sets both the order
  and the header text (a translated label, for instance). Without `columns`, the first row's keys
  in insertion order are used. A key missing from a later row writes an empty field.
- **Lenient reader, strict writer.** A structural problem is a failure carrying its line number:
  an unterminated quoted field, a record whose field count differs from the header's, or a
  duplicate header name in records mode. A bare quote inside an unquoted field is kept and
  reported in `warnings`. The writer produces RFC 4180 output only.
- **BOM is opt-in on write and always stripped on read.** Files for spreadsheets set `bom: true`.
  Files for programs leave it off, since some parsers read the BOM as part of the first header.

Out of scope:

- Streaming parse. `parse` reads a whole string, which covers uploads within a Worker's request
  size. A `parseStream` over `ReadableStream<string>` is a subpath for the first import that
  outgrows it.
- Excel's `sep=;` first line. Excel reads it, other programs import it as a data row.
- `.xlsx`, which is a zipped XML format and a separate package if a consumer ever needs it.

### Exports

```ts
import type { Result } from "@sdxc/result";

export namespace CSV {
	export type Cell = string | number | bigint | boolean | Date | null | undefined;
	export type Delimiter = "," | ";" | "\t";

	export interface ParseOptions {
		/** @default "," */
		delimiter?: Delimiter;
		/** Read the first record as keys. @default true */
		header?: boolean;
	}

	export interface Parsed<T> {
		rows: T[];
		/** Recoverable departures from RFC 4180, e.g. a bare quote in an unquoted field. */
		warnings: { line: number; message: string }[];
	}

	export interface Column<Row> {
		key: keyof Row & string;
		/** Header text; the key when omitted. */
		header?: string;
	}

	export interface StringifyOptions<Row> {
		columns?: Column<Row>[];
		/** @default "," */
		delimiter?: Delimiter;
		/** Write the header record. @default true */
		header?: boolean;
		/** Prefix a UTF-8 BOM so Excel detects the encoding. @default false */
		bom?: boolean;
		/** Neutralize string cells that a spreadsheet would run as formulas. @default true */
		escapeFormulas?: boolean;
	}
}

/** Unterminated quote, field count mismatch, or duplicate header; `line` is 1-based. */
export class CSVParseError extends Error {
	override name = "CSVParseError";
	line: number;
}

/** A cell outside `CSV.Cell` in untyped input, an invalid `Date`, or an unknown delimiter. */
export class CSVStringifyError extends Error {
	override name = "CSVStringifyError";
	row: number;
	column?: string;
}

export function parse(
	source: string,
	options?: CSV.ParseOptions & { header?: true },
): Result<CSV.Parsed<Record<string, string>>, CSVParseError>;
export function parse(
	source: string,
	options: CSV.ParseOptions & { header: false },
): Result<CSV.Parsed<string[]>, CSVParseError>;

export function stringify<Row extends Record<string, CSV.Cell>>(
	rows: Row[],
	options?: CSV.StringifyOptions<Row>,
): Result<string, CSVStringifyError>;

/** Encodes rows as they arrive; a bad cell errors the stream with a `CSVStringifyError`. */
export function streamify<Row extends Record<string, CSV.Cell>>(
	rows: Iterable<Row> | AsyncIterable<Row>,
	options: CSV.StringifyOptions<Row> & { columns: CSV.Column<Row>[] },
): ReadableStream<Uint8Array>;
```

`parse` and `stringify` are separate named exports, as in `@sdxc/yaml`, so importing one leaves the
other out of the bundle. A namespace import reads as the sketch that started this ADR:

```ts
import * as CSV from "@sdxc/csv";
import { unwrap } from "@sdxc/result";

let csvAsString = unwrap(CSV.stringify([obj1, obj2, obj3]));
let listOfObjects = unwrap(CSV.parse(content)).rows;
```

`streamify` requires `columns`, since the header record goes out before any row is seen.
A stream that has already sent its first bytes cannot become a failed `Result`, so a bad cell
errors the stream. Typed callers can still produce one with `NaN`, an infinity or an invalid
`Date`, which the `Cell` type admits and the writer rejects.

### Serving CSV: `@sdxc/http/response`

`@sdxc/http/response` has one builder per content kind, `csv(body: string)` among them. It is
where every other `Content-Type` is set, so `@sdxc/csv` stays a format package with no HTTP
surface. Two changes there cover what a download needs:

```ts
/** `text/csv; charset=utf-8`, for a whole document or one streamed as it is written. */
export function csv(body: string | ReadableStream<Uint8Array>, init?: ResponseInit): Response;

/** An RFC 6266 `attachment` value: an ASCII `filename` plus RFC 8187 `filename*` when needed. */
export function attachment(filename: string): string;
```

`file(body, filename)` switches to `attachment`. It writes `filename="${filename}"` today, which a
quote in the name breaks and which leaves a non-ASCII name unencoded. The `@sdxc/http` change is a
commit of its own, since it touches a different workspace.

### Usage

#### Uptime: a report download

```ts
import { streamify } from "@sdxc/csv";
import { attachment, csv } from "@sdxc/http/response";

return csv(
	streamify(Report.dailyRows(ctx.db, ctx.team, filter), {
		columns: [
			{ key: "date", header: t("reports.columns.date") },
			{ key: "monitor", header: t("reports.columns.monitor") },
			{ key: "uptimePercent", header: t("reports.columns.uptimePercent") },
		],
		delimiter: dialect.delimiter,
		bom: true,
	}),
	{ headers: { "Content-Disposition": attachment("acme-uptime-daily-2026-08.csv") } },
);
```

Uptime ADR-032 covers the report contents, the locale dialects and access rules.

#### Reading an upload

```ts
import { parse } from "@sdxc/csv";
import { parseSafe } from "@sdxc/validate";

let parsed = parse(await file.text());
if (isFailure(parsed)) return badRequest(parsed.error.message);
let rows = parsed.data.rows.map((row) => parseSafe(MonitorImportRow, row));
```

## Consequences

### Positive

- **Spreadsheets open reports correctly** - the BOM and the delimiter option handle the two
  problems people see first: mojibake and everything landing in column A
- **CSV injection is closed by default** - a monitor named `=HYPERLINK(...)` becomes text in the
  client's spreadsheet instead of a live link
- **Exports stay within Worker memory** - `streamify` sends rows as the database returns
  them, so a year of checks is never held as one string
- **One typing path** - uploaded rows go through the same `remix/data-schema` validation as every
  other untrusted input

### Negative

- **No type inference** - every reader writes a schema, including for trivial files
- **The `'` prefix is visible** - a neutralized cell shows its apostrophe in some programs
  (Numbers, LibreOffice with some settings), and a downstream program reads it as part of the value
- **Stream errors come late** - a bad cell in `streamify` truncates a download the browser
  may already be saving; only untyped input can cause one

### Neutral

- **Delimiter choice stays with the caller** - the package does not map locales to separators;
  uptime owns that mapping because it depends on who opens the file
- **TSV comes free** - `delimiter: "\t"` reads and writes it, with the same quoting rules

## Implementation Plan

### Phase 1: Core format

**Priority:** High
**Estimated Effort:** 4 hours

1. Write the tests first: every RFC 4180 §2 example; quoted fields holding delimiters, quotes and
   CRLF; CR, LF and CRLF record endings; a missing final line break; BOM stripping; field count
   mismatch and unterminated quote failures with line numbers; the bare-quote warning;
   neutralization of every trigger character on strings and not on numbers; `Date`, `null`,
   `bigint` and `boolean` cells; `columns` order and header labels; round trips of
   `stringify` into `parse` for each delimiter
2. Implement `parse`, `stringify` and `streamify`
3. README following the package documentation guide, root README table row

### Phase 1b: `@sdxc/http/response`

**Priority:** High
**Estimated Effort:** 1 hour

1. `csv` accepts a `ReadableStream<Uint8Array>` and sets `charset=utf-8`
2. `attachment(filename)`, with tests for quotes, backslashes and non-ASCII names; `file` uses it
3. README sections for both

### Phase 2: Uptime report exports

Tracked in [uptime ADR-032](./uptime/ADR-032-uptime-report-exports.md).

### Phase 3: Publish

**Priority:** Low
**Estimated Effort:** 30 minutes

1. `description`, `LICENSE.md`, `bun run release:bootstrap @sdxc/csv`, trusted publisher

## Alternatives Considered

### 1. Build the CSV string inside uptime

`rows.map((row) => row.join(",")).join("\n")` is one line.

**Rejected because**: quoting, doubled quotes, CRLF, the BOM and formula neutralization are the
parts a one-liner leaves out, and the ones a client notices in their spreadsheet. The second
consumer would copy the one-liner, bugs included.

### 2. Use `papaparse` or `csv-stringify`

Papa Parse is the most widely used browser and Node CSV parser, with type inference and worker
streaming. The `csv` project (`csv-parse`, `csv-stringify`) covers Node streams.

**Rejected because**: both throw or call back with errors instead of returning `Result`, Papa
Parse's inference is the behavior this package leaves to schemas, `csv-stringify` is built on
Node streams where Workers want web streams, and neither neutralizes formulas by default.

### 3. One `stringify` whose result follows its input

`stringify(array)` would return `Result<string>`, and `stringify(iterable)` a `ReadableStream`.

**Rejected because**: an array is an iterable too, so the rule becomes "arrays give strings,
every other iterable gives a stream". Streaming an array then takes `array.values()`, and a `Set`
of rows silently gives a stream. The two outputs also report errors differently (a `Result`
versus an errored stream) and need different options (`columns` is required only when
streaming). `streamify` pairs with `stringify` by name and keeps each return type fixed.

### 4. Infer types on read

**Rejected because**: inference guesses wrong in exactly the cases that matter (leading zeros,
ISO-looking strings, `NaN`), and every caller already has a schema to validate untrusted input.

## References

- [RFC 4180 - Common Format and MIME Type for CSV Files](https://www.rfc-editor.org/rfc/rfc4180)
- [RFC 6266 - Content-Disposition in HTTP](https://www.rfc-editor.org/rfc/rfc6266)
- [RFC 8187 - Character Set and Language Encoding for HTTP Header Parameters](https://www.rfc-editor.org/rfc/rfc8187)
- [OWASP - CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection)
- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)
- [ADR-091: iCalendar Package](./ADR-091-icalendar-package.md)
- [Uptime ADR-032: Uptime Reports as CSV Downloads](./uptime/ADR-032-uptime-report-exports.md)

## Notes

- Implementation: the types are top-level exports (`Cell`, `Column`, `StringifyOptions` and the
  rest) instead of members of a `CSV` namespace, so the namespace import above reads `CSV.Cell`
  beside `CSV.parse`, where a namespace inside the module would read `CSV.CSV.Cell`.
- Implementation: rows are constrained by `CellRecord<Row>` (`{ [Key in keyof Row]: Cell }`)
  instead of `Record<string, Cell>`, which rows typed by an interface do not satisfy, since
  interfaces carry no implicit index signature.
- Implementation: `stringify` has a second overload for arrays of cells, written as records with
  no header; `streamify` takes objects only.
- Implementation: text after a closing quote (`"one"two`) is a structural failure beside the
  three listed. Blank lines are skipped on read, and the writer writes a record of one empty field
  as `""` so it reads back.
- Implementation: `CSVStringifyError.row` is optional, absent when the options are at fault (an
  unknown delimiter); `NaN` and infinities are rejected as cells with no representation.
- Implementation: `streamify` buffers about 16 KB of text per chunk, sends the BOM and header
  from `start` before the first row is read, and calls the iterator's `return()` on cancel and on
  a bad cell.

## Current Progress

- [x] Phase 1: Core format (`parse`, `stringify`, `streamify`, README)
- [x] Phase 1b: `@sdxc/http/response` stream-capable `csv` and `attachment`
- [ ] Phase 2: Uptime report exports
- [ ] Phase 3: Publish
