# @sdxc/jsonl

JSON Lines reading and writing, streamed with a bounded buffer and line numbers in every failure.

## Installation

```sh
npm add @sdxc/jsonl
```

Every reader answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs alongside this package.

## Usage

### Parse and write a file in memory

```typescript
import * as JSONL from "@sdxc/jsonl";
import { isFailure } from "@sdxc/result";

let parsed = JSONL.parse('{"id":1}\n\n{"id":2}\n');
if (isFailure(parsed)) throw parsed.error; // "Line is not valid JSON (…) at line 3"
parsed.data; // [{ id: 1 }, { id: 2 }]

let text = JSONL.stringify([{ id: 1 }, { id: 2 }]); // success('{"id":1}\n{"id":2}\n')
```

[JSON Lines](https://jsonlines.org) (also published as NDJSON) is one JSON value per line. Every reader in this package applies the same line rules: `\n` ends a line and a `\r` before it is removed, a last line without a newline still counts, blank lines are skipped but counted so line numbers match an editor's, and a leading byte-order mark is ignored.

### Stream values from a request body

```typescript
import * as JSONL from "@sdxc/jsonl";
import { isFailure } from "@sdxc/result";

for await (let entry of JSONL.read(request.body, { maxLineBytes: 1_048_576 })) {
	if (isFailure(entry)) {
		entry.error.line; // 1-based, counting blank lines
		continue;
	}
	entry.data.value; // the parsed value
}
```

A line that is not JSON yields a failure and reading continues; a line longer than `maxLineBytes` yields one failure and reading stops, so untrusted input never grows the buffer past it.

### Stream values into a response

```typescript
import * as JSONL from "@sdxc/jsonl";

let body = JSONL.encode(rows); // ReadableStream<Uint8Array>, one value pulled per line
return new Response(body, { headers: { "Content-Type": "application/jsonl" } });
```

## API

### `parse(text: string): Result<unknown[], JSONLError>`

Every value in `text`, or the first line that is not JSON.

### `stringify(values: Iterable<unknown>): Result<string, JSONLError>`

Each value written with `JSON.stringify` on its own `\n`-terminated line, so the output ends with a newline and an empty input is an empty string. A value `JSON.stringify` cannot write — a function, a bare `undefined`, a `BigInt`, a cycle — fails with the line it would have taken.

### `lines(source: ByteSource, options?: LinesOptions): AsyncGenerator<Result<Line, JSONLError>>`

Every non-blank line of `source` as text, without parsing it. Bytes are split at `\n` before decoding, so a character split across chunks decodes once.

- `options.maxLineBytes`: The longest line accepted, in encoded UTF-8 bytes. A longer line yields one `line-too-long` failure and reading stops.
- `options.skip`: How many non-blank lines to drop before the first one yielded. It counts values, not lines, so a run that consumed N values resumes at the same row whatever blank lines the input holds; the lines after it keep their full line numbers.

When the caller stops iterating early, a `ReadableStream` source has its lock released and stays unread.

### `read(source: ByteSource, options?: ReadOptions): AsyncGenerator<Result<Entry, JSONLError>>`

`lines` plus `JSON.parse` per line. `options` takes `maxLineBytes` and `skip`, plus `schema`: any [Standard Schema](https://standardschema.dev), synchronous or asynchronous, whose output types `entry.data.value`. A line that is not JSON, or that the schema rejects, yields a failure with its line number and reading continues.

### `encode(values: Iterable<unknown> | AsyncIterable<unknown>): ReadableStream<Uint8Array>`

`stringify` as a byte stream, pulling one value per line. An unserializable value errors the stream with its `JSONLError`; cancelling the stream returns the iterator.

### `encodeLines(lines: Iterable<string> | AsyncIterable<string>): ReadableStream<Uint8Array>`

Lines that are already JSON, written byte for byte with a `\n` after each, for copying rows from one JSON Lines file to another without re-serializing them. A line holding a `\n` or `\r` errors the stream.

### `JSONLError`

The failure every reader and writer reports. `message` ends with `at line <line>`; the fields are:

- `code`: `"line-too-long"`, `"invalid-json"`, `"invalid-value"` or `"unserializable"`.
- `line`: 1-based, counting blank lines.
- `issues`: the schema's issues for `"invalid-value"`, empty otherwise.

### Types

#### `ByteSource`

`ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>`: a fetch body, a file stream, or any async iterable of chunks.

#### `Line`

`{ text, number }`: one non-blank line without its line ending, and its 1-based line number.

#### `Entry<T>`

`{ value, number }`: one parsed (and validated) value, and the line it came from.

## Patterns

### Pattern: Import an uploaded file row by row

Validate each row of an upload with a Standard Schema such as [`remix/data-schema`](https://www.npmjs.com/package/remix), collecting the bad rows with their line numbers instead of failing the whole upload.

```typescript
import * as JSONL from "@sdxc/jsonl";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";

let Contact = s.object({ email: s.string(), name: s.string() });

async function importContacts(request: Request) {
	if (request.body === null) return { imported: 0, errors: [] };
	let imported = 0;
	let errors: { line: number; message: string }[] = [];
	for await (let entry of JSONL.read(request.body, { schema: Contact, maxLineBytes: 65_536 })) {
		if (isFailure(entry)) {
			errors.push({ line: entry.error.line, message: entry.error.message });
			continue;
		}
		await saveContact(entry.data.value);
		imported += 1;
	}
	return { imported, errors };
}
```

A `line-too-long` failure is always the last entry `read` yields, so the loop records it and ends on its own.

### Pattern: Resume a long import where it stopped

Store how many values a run consumed, and pass that count as `skip` on the next run.

```typescript
import * as JSONL from "@sdxc/jsonl";
import { isFailure } from "@sdxc/result";

async function resume(file: ReadableStream<Uint8Array>, cursor: number) {
	for await (let entry of JSONL.read(file, { skip: cursor })) {
		if (isFailure(entry)) return { cursor, error: entry.error };
		await process(entry.data.value);
		cursor += 1;
	}
	return { cursor };
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
		"@sdxc/jsonl": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
