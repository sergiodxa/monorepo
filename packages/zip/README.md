# @sdxc/zip

Streaming ZIP archive writer with CRC-32, storing every entry uncompressed.

Every entry is written stored (method 0), with its CRC-32 and sizes in the local header, so the
archive opens in every unarchiver and streaming reader. Stored entries are larger than compressed
ones: a text-heavy archive is three to four times the size a DEFLATE archive would be, while
images, fonts and other already-compressed files cost nothing extra. Compression is planned and
will arrive behind the same API.

## Installation

```sh
npm add @sdxc/zip
```

Failures are values from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which
installs alongside this package and supplies `isFailure` and `isSuccess`. The writer needs only
Web Streams and `TextEncoder`, so it runs in Workers, Bun, Node and the browser.

## Usage

### A Download Built From Strings And Bytes

```typescript
import { Zip } from "@sdxc/zip";

let zip = new Zip();
zip.add("README.txt", "Exported on 2026-10-08\n");
zip.add("feeds.opml", opml);
zip.add("images/avatar.png", avatarBytes, { modified: new Date("2026-10-01T00:00:00Z") });

return new Response(zip.stream(), {
	headers: {
		"content-type": "application/zip",
		"content-disposition": `attachment; filename="export.zip"`,
	},
});
```

### Entries Produced As Streams

Entries are written one after another in the order they were added. A stream entry is read
whole when the archive reaches it, so memory holds one entry at a time.

```typescript
import { isFailure } from "@sdxc/result";
import { Zip } from "@sdxc/zip";

let zip = new Zip();
for (let kind of ["summary", "daily", "incidents"]) {
	let added = zip.add(`reports/${kind}.csv`, reportStream(kind));
	if (isFailure(added)) return new Response(added.error.message, { status: 400 });
}
return new Response(zip.stream(), { headers: { "content-type": "application/zip" } });
```

### The Whole Archive As Bytes

```typescript
let bytes = await zip.bytes();
if (isFailure(bytes)) throw bytes.error;
await bucket.put(`exports/${userId}.zip`, bytes.data);
```

### CRC-32 On Its Own

```typescript
import { crc32 } from "@sdxc/zip";

crc32(new TextEncoder().encode("123456789")); // 0xcbf43926

let running = 0;
for (let chunk of chunks) running = crc32(chunk, running);
```

## API

### `Zip`

An archive being assembled. Entries keep the order they were added in, and the same entries
with the same timestamps always produce the same bytes.

#### `zip.add(path: string, source: ZipSource, options?: ZipEntryOptions): Result<void, ZipError>`

Adds an entry from a string (written as UTF-8), a `Uint8Array`, or a `ReadableStream<Uint8Array>`.
The name is checked immediately: an empty name, a leading `/`, a backslash, an empty, `.` or `..`
segment, a control character or a duplicate fails with `invalid-entry`, and the archive is left
unchanged. The 65,536th entry fails with `too-large`.

| Option     | Default      | Meaning                                                          |
| ---------- | ------------ | ---------------------------------------------------------------- |
| `modified` | `1980-01-01` | The entry's timestamp, recorded in UTC with two-second precision |
| `comment`  | None         | A comment written in the central directory                       |

A stream source is read once, when the archive reaches it, so an archive holding one is written
once.

#### `zip.stream(): ReadableStream<Uint8Array>`

The archive as a stream, ready for a `Response` body. When a source stream errors, the output
stream errors with a `ZipError` whose code is `source-failed` and whose `cause` is the source's
error; a response already under way has no other channel. Cancelling the output cancels every
stream source it has not reached.

#### `zip.bytes(): Promise<Result<Uint8Array, ZipError>>`

The whole archive in one buffer, or the error the stream failed with.

### `crc32(bytes: Uint8Array, previous?: number): number`

The CRC-32 ZIP, PNG and gzip use. Pass the previous value to continue across chunks. The lookup
table is built on the first call.

### `ZipError`

Carries a `code`, the `entry` name it concerns when there is one, and the source's error as
`cause` for `source-failed`.

| Code            | When                                                                                    |
| --------------- | --------------------------------------------------------------------------------------- |
| `invalid-entry` | A name, timestamp (outside 1980–2107) or comment (over 64 KiB) ZIP cannot record        |
| `too-large`     | An entry or the archive past 4 GiB, or more than 65,535 entries; ZIP64 is not written   |
| `source-failed` | A stream source errored or yielded something other than a `Uint8Array` while being read |

### Types

`ZipSource` is `string | Uint8Array | ReadableStream<Uint8Array>`; `ZipEntryOptions` holds
`modified` and `comment`.

## Pattern: Handling Every Failure

```typescript
import { isFailure } from "@sdxc/result";
import { Zip } from "@sdxc/zip";

let zip = new Zip();
let added = zip.add(userSuppliedName, content);
if (isFailure(added)) {
	// invalid-entry: "../secrets.txt", a duplicate, a bad date
	// too-large: the 65,536th entry
	return new Response(added.error.message, { status: 400 });
}

let result = await zip.bytes();
if (isFailure(result) && result.error.code === "source-failed") {
	console.error("A source stream failed", result.error.entry, result.error.cause);
}
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/zip": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
