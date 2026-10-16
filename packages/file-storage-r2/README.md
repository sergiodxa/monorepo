# @sdxc/file-storage-r2

A [`remix/file-storage`](https://www.npmjs.com/package/remix) `FileStorage` backed by a
Cloudflare R2 bucket.

## Installation

```sh
npm add @sdxc/file-storage-r2
```

It implements the `FileStorage` interface from [`remix`](https://www.npmjs.com/package/remix),
which you install alongside it.

## Usage

### Create the storage

```typescript
import { R2FileStorage } from "@sdxc/file-storage-r2";

let storage = new R2FileStorage(env.UPLOADS);
```

An `R2Bucket` binding passes straight through.

### Store and read a file

```typescript
await storage.set("avatars/ada.png", file);

let avatar = await storage.get("avatars/ada.png"); // File | null
avatar?.name; // "ada.png"
avatar?.type; // "image/png"
```

A file reads back as a native `File` with the name, type and `lastModified` it was stored
with. An object
written to the bucket some other way reads back named by its key, typed by its content
type, and dated by when R2 received it.

### Page through a prefix

```typescript
let cursor: string | undefined;
do {
	let page = await storage.list({ prefix: "avatars/", limit: 100, cursor, includeMetadata: true });
	for (let file of page.files) console.info(file.key, file.size, file.type);
	cursor = page.cursor;
} while (cursor);
```

## API

### `new R2FileStorage(bucket: R2FileBucket)`

A `FileStorage` over the bucket. The file's name and `lastModified` are stored as the
object's custom metadata and its type as the content type.

- `get(key)` resolves the stored `File`, read whole into memory, or `null` when the key holds
  nothing.
- `has(key)` answers with a `HEAD`, so it transfers no body.
- `list(options?)` lists keys in order. `prefix`, `cursor` and `limit` pass to R2; the result
  carries a `cursor` while more remain. With `includeMetadata: true` each entry also has
  `name`, `size`, `type` and `lastModified`.
- `put(key, file)` stores the file and resolves it as read back from the bucket.
- `set(key, file)` stores the file, replacing whatever the key held.
- `remove(key)` deletes the object; removing a missing key succeeds.

### Types

#### `R2FileBucket`

The bucket methods the storage calls (`get`, `head`, `list`, `put`, `delete`). Every
`R2Bucket` binding satisfies it, whether `wrangler types` or `@cloudflare/workers-types` typed
it, so the package needs no Cloudflare type definitions of its own.

#### `R2FileObject`

An object as `head` and `list` answer it: `key`, `size`, `uploaded` and its metadata.

## Pattern: Cache rendered images in R2

Render once per key, then serve the stored file on every later request.

```typescript
import { R2FileStorage } from "@sdxc/file-storage-r2";

export default {
	async fetch(request: Request, env: { IMAGES: R2Bucket }): Promise<Response> {
		let storage = new R2FileStorage(env.IMAGES);
		let key = new URL(request.url).pathname.slice(1);

		let file = await storage.get(key);
		if (!file) {
			let bytes = await render(key);
			file = await storage.put(key, new File([bytes], `${key}.png`, { type: "image/png" }));
		}

		return new Response(file, {
			headers: { "Content-Type": file.type, "Cache-Control": "public, max-age=31536000" },
		});
	},
};
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
		"@sdxc/file-storage-r2": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
