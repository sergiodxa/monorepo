---
name: sdxc-zip
description: "@sdxc/zip writes ZIP archives — `new Zip()`, `zip.add(path, string | Uint8Array | ReadableStream, { modified, comment })` answering `Result<void, ZipError>`, then `zip.stream()` for a Response body or `zip.bytes()` for a `Result<Uint8Array, ZipError>` — plus `crc32(bytes, previous?)`. Every entry is stored uncompressed. Use when a download bundles several files (CSV reports, data exports), when building an EPUB container, or when a format needs a CRC-32."
---

# @sdxc/zip

A store-only streaming ZIP writer. Entries are written in the order added, each with its CRC-32 and sizes in the local header and bit 3 clear, so every unarchiver and streaming reader opens the result. A stream entry is read whole when the archive reaches it; memory holds one entry at a time. Names are validated on `add` (`invalid-entry` for empty, absolute, backslash, `.`/`..`/empty segments, control characters, duplicates); the 65,536th entry or anything past 4 GiB is `too-large` (no ZIP64); a failing source stream errors the output with `source-failed` and the original error as `cause`.

Full API and examples: [packages/zip/README.md](packages/zip/README.md)

## Using it

```json
{ "dependencies": { "@sdxc/zip": "workspace:*" } }
```

```typescript
import { Zip } from "@sdxc/zip";

let zip = new Zip();
zip.add("summary.csv", summaryCsv);
zip.add("daily.csv", dailyStream);
return new Response(zip.stream(), {
	headers: {
		"content-type": "application/zip",
		"content-disposition": `attachment; filename="report.zip"`,
	},
});
```

## Suggestions

- Check the `Result` of `add` whenever a name comes from user input; it is the path-traversal guard.
- Leave `modified` at its fixed default when output should be byte-stable (fixtures, cached objects).
- Entries are uncompressed: fine for small exports and already-compressed files, three to four times larger for big text archives.
- Log `error.code` and `error.entry` when `bytes()` fails or the response stream errors.

## Related

- `@sdxc/epub` — builds EPUB publications on top of this writer
- `@sdxc/csv` — produces the CSV streams a report archive bundles
- `@sdxc/result` — the `Result` `add` and `bytes` answer; skill `sdxc-result`
