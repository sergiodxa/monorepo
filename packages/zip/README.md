# @sdxc/zip

Streaming ZIP archive writer with CRC-32, storing every entry uncompressed.

Every entry is stored (method 0) with its CRC-32 and sizes in the local header, so the archive
opens in every unarchiver and streaming reader. Images, fonts and other compressed files cost
nothing extra; text-heavy archives come out three to four times the size of a DEFLATE archive.

## Installation

```sh
npm add @sdxc/zip
```

Failures are values from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which
installs alongside and supplies `isFailure`. The writer needs only Web Streams and `TextEncoder`,
so it runs in Workers, Bun, Node and the browser.

## Usage

### Build an archive and stream it

```typescript
import { Zip } from "@sdxc/zip";

let zip = new Zip();
zip.add("README.txt", "Exported on 2026-10-08\n");
zip.add("images/avatar.png", avatarBytes, { modified: new Date("2026-10-01T00:00:00Z") });

return new Response(zip.stream(), { headers: { "content-type": "application/zip" } });
```

A string is written as UTF-8; a `Uint8Array` is written as is. Entries keep the order they were
added in.

### Add entries from streams

```typescript
import { Zip } from "@sdxc/zip";

let zip = new Zip();
zip.add("reports/summary.csv", summaryStream);
zip.add("reports/daily.csv", dailyStream);

return new Response(zip.stream(), { headers: { "content-type": "application/zip" } });
```

A stream source is read whole when the archive reaches it, so memory holds one entry at a time.
It is read once, so an archive holding a stream is written once.

### Check each entry

```typescript
import { isFailure } from "@sdxc/result";
import { Zip } from "@sdxc/zip";

let zip = new Zip();
let added = zip.add("../outside.txt", "content");
if (isFailure(added)) added.error.code; // "invalid-entry"; the archive is unchanged
```

### Collect the archive as bytes

```typescript
import { isFailure } from "@sdxc/result";
import { Zip } from "@sdxc/zip";

let zip = new Zip();
zip.add("notes.txt", "Hello");

let bytes = await zip.bytes();
if (isFailure(bytes)) throw bytes.error;
bytes.data; // Uint8Array, ready to store or measure
```

## API

### `Zip`

An archive being assembled. The same entries with the same timestamps always produce the same
bytes.

#### `zip.add(path: string, source: ZipSource, options?: ZipEntryOptions): Result<void, ZipError>`

Adds an entry under a `/`-separated relative path. Fails with `invalid-entry` for an empty name,
a leading `/`, a backslash, an empty, `.` or `..` segment, a control character, a duplicate, a
`modified` outside 1980–2107, or a name or comment over 65,535 bytes; fails with `too-large` for
the 65,536th entry or bytes over 4 GiB. A refused entry leaves the archive unchanged.

- `options.modified`: the entry's timestamp, recorded with two-second precision; defaults to
  1980-01-01
- `options.comment`: a comment written in the central directory

#### `zip.stream(): ReadableStream<Uint8Array>`

The archive as a stream, ready for a `Response` body. It errors with a `ZipError` when a source
stream fails (`source-failed`, the source's error as `cause`) or the archive passes 4 GiB
(`too-large`). Cancelling it, or a failure, cancels every stream source it has not reached.

#### `zip.bytes(): Promise<Result<Uint8Array, ZipError>>`

The whole archive in one buffer, or the `ZipError` the stream failed with.

### `crc32(bytes: Uint8Array, previous?: number): number`

The unsigned CRC-32 that ZIP, PNG and gzip use. Pass the previous value to continue across
chunks; the result equals one call over the whole buffer.

### `ZipError`

An `Error` with a `code`, the `entry` name it concerns when there is one, and the source's error
as `cause` for `source-failed`.

| Code            | When                                                                       |
| --------------- | -------------------------------------------------------------------------- |
| `invalid-entry` | A name, timestamp or comment ZIP cannot record, or a duplicate name        |
| `too-large`     | An entry or the archive past 4 GiB, or more than 65,535 entries (no ZIP64) |
| `source-failed` | A stream source errored or yielded something other than a `Uint8Array`     |

### Types

- `ZipSource`: `string | Uint8Array | ReadableStream<Uint8Array>`
- `ZipEntryOptions`: `{ modified?: Date; comment?: string }`
- `ZipError.Code`: `"invalid-entry" | "too-large" | "source-failed"`

## Pattern: A Download Endpoint Built From Paged Data

Each entry's stream produces its rows as the archive reaches it, and the response starts before
the last entry is generated.

```typescript
import { Zip } from "@sdxc/zip";

function csvStream(pages: () => AsyncIterable<string[][]>): ReadableStream<Uint8Array> {
	let encoder = new TextEncoder();
	let iterator = pages()[Symbol.asyncIterator]();
	return new ReadableStream({
		async pull(controller) {
			let next = await iterator.next();
			if (next.done) return controller.close();
			let text = next.value.map((row) => row.join(",")).join("\n") + "\n";
			controller.enqueue(encoder.encode(text));
		},
	});
}

export async function handleExport(request: Request): Promise<Response> {
	let zip = new Zip();
	zip.add(
		"orders.csv",
		csvStream(() => listOrderPages()),
	);
	zip.add(
		"customers.csv",
		csvStream(() => listCustomerPages()),
	);
	zip.add("README.txt", `Exported on ${new Date().toISOString()}\n`);

	return new Response(zip.stream(), {
		headers: {
			"content-type": "application/zip",
			"content-disposition": `attachment; filename="export.zip"`,
		},
	});
}
```

## Pattern: Accepting User-Supplied File Names

Names that would escape the extraction folder are refused, so an upload bundle can take paths
from user input and answer a 400 for the bad ones.

```typescript
import { isFailure } from "@sdxc/result";
import { Zip } from "@sdxc/zip";

interface Upload {
	path: string;
	bytes: Uint8Array;
}

export function bundle(uploads: Upload[]): Response {
	let zip = new Zip();
	for (let upload of uploads) {
		let added = zip.add(upload.path, upload.bytes);
		if (isFailure(added)) {
			return Response.json(
				{ code: added.error.code, entry: added.error.entry, message: added.error.message },
				{ status: 400 },
			);
		}
	}
	return new Response(zip.stream(), { headers: { "content-type": "application/zip" } });
}
```

## Pattern: Reproducible Archives

With fixed timestamps the same entries give the same bytes, so the archive's hash identifies its
content and a cache can skip re-uploading it. Stored entries also satisfy formats that require an
uncompressed first entry, such as EPUB's `mimetype`.

```typescript
import { isFailure } from "@sdxc/result";
import { Zip } from "@sdxc/zip";

let modified = new Date("2026-01-01T00:00:00Z");

let zip = new Zip();
zip.add("mimetype", "application/epub+zip", { modified });
zip.add("META-INF/container.xml", containerXml, { modified });
zip.add("OEBPS/content.opf", packageDocument, { modified });

let archive = await zip.bytes();
if (isFailure(archive)) throw archive.error;

let digest = await crypto.subtle.digest("SHA-256", archive.data);
let etag = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
```

## Pattern: A Source That Fails Partway

A failing stream source surfaces as `source-failed` with the original error as `cause`. With
`bytes()` it comes back as a value; while streaming a response, the response body errors.

```typescript
import { isFailure } from "@sdxc/result";
import { Zip } from "@sdxc/zip";

let zip = new Zip();
zip.add("report.csv", reportStream);
zip.add("raw.json", rawStream);

let result = await zip.bytes();
if (isFailure(result)) {
	if (result.error.code === "source-failed") {
		return Response.json(
			{ entry: result.error.entry, reason: String(result.error.cause) },
			{ status: 502 },
		);
	}
	return Response.json({ message: result.error.message }, { status: 413 });
}
return new Response(result.data, { headers: { "content-type": "application/zip" } });
```

## Pattern: Checksumming A Stream In Chunks

`crc32` continues from a previous value, so a stream is checksummed without buffering it.

```typescript
import { crc32 } from "@sdxc/zip";

export async function checksum(stream: ReadableStream<Uint8Array>): Promise<string> {
	let crc = 0;
	for await (let chunk of stream) crc = crc32(chunk, crc);
	return crc.toString(16).padStart(8, "0");
}

crc32(new TextEncoder().encode("123456789")); // 0xcbf43926
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
