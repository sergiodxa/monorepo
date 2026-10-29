# ADR-139: `@sdxc/jsonl` Package

## Status

**Accepted** - 2026-10-15

## Background

JSON Lines (also published as NDJSON) is one JSON value per line. The repo reads it in three
places, each with its own copy of the same line splitter, and the `sdxc` CLI adds a fourth reader
and a writer for its lock file (`.config/sdxc.lock.jsonl` by default, ADR-141) and its release
changelog (ADR-144).

## Context

### Where the format is read and written today

| Location                                                            | What it does                                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `apps/auth-saas/app/http/controllers/management/subjects/import.ts` | `readRequestBodyLines` splits an uploaded request body into lines and streams them into R2       |
| `apps/auth-saas/app/models/transfer-storage.ts`                     | `readTransferFileLines` splits an R2 object, skipping a resume offset; `writeTransferFile` joins |
| `packages/spec/src/transport-stdio.ts`                              | `readLines` splits a plugin's stdout, then `JSON.parse` per line                                 |
| `packages/http/src/content-type.ts`                                 | Exports the `application/jsonl` and `application/x-ndjson` media types                           |

### How the copies differ

- `auth-saas` skips blank lines; `@sdxc/spec` yields them.
- `readTransferFileLines`'s `startLine` resumes a run from its stored `cursor`, and counts only
  non-blank lines toward it: the cursor is a number of rows, not of lines.
- `readRequestBodyLines` documents that it decodes and buffers "exactly the way"
  `readTransferFileLines` does, so the two are kept identical by hand.
- None caps a line's length: input with no newline is buffered whole, in a Worker's memory for the
  uploaded body.
- None removes the `\r` of a `\r\n` line ending. `JSON.parse` treats it as whitespace, but the raw
  lines `auth-saas` writes to R2 keep it.
- Each re-slices its buffer after every line, which copies the remainder once per line in a large
  chunk.

## Decision

Add `@sdxc/jsonl`, imported as a namespace like `@sdxc/yaml`:

```ts
import * as JSONL from "@sdxc/jsonl";

let entries = JSONL.parse(text); // Result<unknown[], JSONLError>
let output = JSONL.stringify(values); // Result<string, JSONLError>, each line "\n"-terminated

for await (let line of JSONL.lines(body, { maxLineBytes: 1_048_576 })) {
	if (isFailure(line)) return line; // the limit, with the line number
	line.data.text; // raw line, `line.data.number` its 1-based number
}

for await (let entry of JSONL.read(body, { schema: Subject })) {
	if (isFailure(entry)) continue; // parse or validation failure, with the line number
	entry.data.value;
}

let stream = JSONL.encode(rows); // ReadableStream<Uint8Array> from an (async) iterable
let copy = JSONL.encodeLines(texts); // already-serialized lines, written byte for byte
```

Every reader and writer fails with one `JSONLError`, whose `code` names the step that failed
(`line-too-long`, `invalid-json`, `invalid-value`, `unserializable`), with `line` the 1-based line
number and `issues` the schema's issues for `invalid-value`. A caller handling a stream of results
branches on `code` instead of on several classes.

### Line rules, shared by every reader

- `\n` ends a line, and a `\r` before it is removed. A last line with no newline is still a line.
- Blank lines are skipped and still counted, so line numbers match an editor's.
- A byte-order mark at the start is ignored. Bytes are decoded as UTF-8 with a streaming decoder,
  so a character split across chunks decodes once.
- The buffer is scanned by offset and compacted once per chunk.

### Readers

- **`lines(source, options)`** reads a `ReadableStream<Uint8Array>` or `AsyncIterable<Uint8Array>`
  and yields `Result<Line, JSONLError>`. `maxLineBytes` bounds the buffer in encoded UTF-8 bytes,
  the unit memory is spent in, before decoding: a line that exceeds it yields one failure and
  reading stops.
- **`skip`** drops the first N non-blank lines, so it takes a count of values a previous run
  consumed (`auth-saas`'s `cursor`) and resumes at the same row whatever blank lines the input
  holds. Line numbers on the lines that follow still count every line.
- **`read(source, options)`** is `lines` plus `JSON.parse` and an optional Standard Schema per
  line; a line that fails yields a failure carrying its number and reading continues, so the
  caller decides whether one bad row ends the run.
- **`parse(text)`** reads a whole string and answers the first failure with its line number.

### Writers

- **`stringify(values)`** writes each value with `JSON.stringify` and a `\n`, and a final newline.
- **`encode(values)`** does the same lazily into a byte stream, for a response body or an R2 put.
- **`encodeLines(lines)`** streams lines that are already JSON verbatim, one per `\n`. A consumer
  copying rows between files (`auth-saas` moves raw lines from an upload into transfer files)
  keeps their exact bytes; a parse and re-stringify would rewrite their whitespace and number
  formatting, and cost a full parse per row.

A value whose `JSON.stringify` would contain a raw newline cannot occur, since JSON escapes
newlines in strings; a value that serializes to `undefined` (a function, a bare `undefined`) or
throws (a cycle, a `BigInt`) is an `unserializable` failure, and so is a line given to
`encodeLines` that holds a `\n` or `\r`. The streaming writers error the stream with it.

The package depends on `@sdxc/result` alone and runs wherever Web Streams and `TextDecoder` do,
Workers included. The media-type constants stay in `@sdxc/http`.

### Consumers

- The `sdxc` CLI reads and writes its lock file with `parse` and `stringify`.
- `auth-saas` replaces `readRequestBodyLines` and `readTransferFileLines` with `lines`, gaining a
  line-length cap on the uploaded body, and `writeTransferFile`'s joining with `encodeLines`. Its
  `startLine` becomes `skip`, which counts the same rows, so a run stored mid-transfer resumes at
  the same row after the migration.
- `@sdxc/spec` replaces `readLines` with `lines`, and its per-line `JSON.parse` with `read`.

Each migration is its own commit in its own workspace.

## Consequences

### Positive

- **One set of line rules** for blank lines, `\r\n` and a final line without a newline.
- **A bounded buffer** wherever the input is untrusted, which the uploaded import body is.
- **Line numbers in every failure**, matching what an editor shows.

### Negative

- **Another package to publish**, and three call sites to migrate.
- **`@sdxc/spec` changes behavior on blank lines.** Today a blank line from a plugin fails
  `JSON.parse` and is treated as a broken reply; afterwards it is skipped.
- **`auth-saas` writes different bytes for `\r\n` input.** An uploaded body with Windows line
  endings is stored in R2 without the `\r`. Each row parses to the same value; a transfer file
  written before the migration and read after it still resumes correctly, since `skip` and the
  removed `\r` affect neither the row count nor the parsed values.

### Neutral

- NDJSON and JSON Lines are read identically; the package uses the JSON Lines name, matching the
  `.jsonl` extension the CLI writes.

## Alternatives Considered

### 1. A private splitter in each consumer

**Rejected because**: that is today's state, and the copies already disagree on blank lines and
share the same missing length cap.

### 2. Line splitting only, with parsing left to callers

**Rejected because**: every consumer parses each line next, and validation per line with its line
number is the part that most needs to be the same everywhere.

### 3. Adding it to `@sdxc/http`

**Rejected because**: the lock file and the stdio transport read JSON Lines with no HTTP involved.

## References

- [JSON Lines](https://jsonlines.org)
- [ADR-141: `sdxc ui` Component Vendoring](./ADR-141-sdxc-ui-component-vendoring.md)
- [ADR-144: `sdxc upgrade`](./ADR-144-sdxc-upgrade.md)

## Current Progress

- [x] `@sdxc/jsonl` with `parse`, `stringify`, `lines`, `read`, `encode` and `encodeLines`
- [x] `sdxc` lock file on `@sdxc/jsonl` (now under `@sdxc/kit`; see [ADR-183](./ADR-183-drop-sdxc-umbrella.md))
- [x] `auth-saas` transfer files and import body on `lines` and `encode`
- [x] `@sdxc/spec` stdio transport on `lines` and `read`
