# ADR-139: `@sdxc/jsonl` Package

## Status

**Proposed** - 2026-10-14

## Background

JSON Lines (also published as NDJSON) is one JSON value per line. The repo reads it in three
places, each with its own copy of the same line splitter, and the `sdxc` CLI (ADR-136) adds a
fourth reader and a writer for its lock file (`.config/sdxc.lock.jsonl` by default).

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

let entries = JSONL.parse(text); // Result<unknown[], JSONLParseError>
let output = JSONL.stringify(values); // one line per value, each "\n"-terminated

for await (let line of JSONL.lines(body, { maxLineLength: 1_048_576 })) {
	if (isFailure(line)) return line; // the limit, with the line number
	line.data.text; // raw line, `line.data.number` its 1-based number
}

for await (let entry of JSONL.read(body, { schema: Subject })) {
	if (isFailure(entry)) continue; // parse or validation failure, with the line number
	entry.data.value;
}

let stream = JSONL.encode(rows); // ReadableStream<Uint8Array> from an (async) iterable
```

### Line rules, shared by every reader

- `\n` ends a line, and a `\r` before it is removed. A last line with no newline is still a line.
- Blank lines are skipped and still counted, so line numbers match an editor's.
- A byte-order mark at the start is ignored. Bytes are decoded as UTF-8 with a streaming decoder,
  so a character split across chunks decodes once.
- The buffer is scanned by offset and compacted once per chunk.

### Readers

- **`lines(source, options)`** reads a `ReadableStream<Uint8Array>` or `AsyncIterable<Uint8Array>`
  and yields `Result<Line, JSONLError>`. `maxLineLength` bounds the buffer: a line that exceeds it
  yields one failure and reading stops. `skip` drops the first N lines, for resuming.
- **`read(source, options)`** is `lines` plus `JSON.parse` and an optional Standard Schema per
  line; a line that fails yields a failure carrying its number and reading continues, so the
  caller decides whether one bad row ends the run.
- **`parse(text)`** reads a whole string and answers the first failure with its line number.

### Writers

- **`stringify(values)`** writes each value with `JSON.stringify` and a `\n`, and a final newline.
- **`encode(values)`** does the same lazily into a byte stream, for a response body or an R2 put.

A value whose `JSON.stringify` would contain a raw newline cannot occur, since JSON escapes
newlines in strings; a value that serializes to `undefined` (a function, a bare `undefined`) is a
failure.

The package depends on `@sdxc/result` alone and runs wherever Web Streams and `TextDecoder` do,
Workers included. The media-type constants stay in `@sdxc/http`.

### Consumers

- The `sdxc` CLI reads and writes its lock file with `parse` and `stringify`.
- `auth-saas` replaces `readRequestBodyLines` and `readTransferFileLines` with `lines`, gaining a
  line-length cap on the uploaded body, and `writeTransferFile`'s joining with `encode`.
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
- [ADR-136: `sdxc` Umbrella Package and CLI](./ADR-136-sdxc-umbrella-package-and-cli.md)

## Current Progress

- [ ] `@sdxc/jsonl` with `parse`, `stringify`, `lines`, `read` and `encode`
- [ ] `sdxc` lock file on `@sdxc/jsonl`
- [ ] `auth-saas` transfer files and import body on `lines` and `encode`
- [ ] `@sdxc/spec` stdio transport on `lines` and `read`
