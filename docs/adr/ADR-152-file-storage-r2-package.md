# ADR-152: `@sdxc/file-storage-r2` Stores `remix/file-storage` Files in R2

## Status

**Accepted** - 2026-10-15

## Background

The packages site and the blog both render social cards in a Worker and cache each one in an
R2 bucket (see [sdxc-site ADR-002](./sdxc-site/ADR-002-social-cards.md)). Each app reads and
writes the cards through `remix/file-storage`'s `FileStorage`, so the image route handles
`File`s and a test can substitute any backend. The adapter from `FileStorage` to an R2 bucket
was written in one app and copied verbatim into the other, which is the second copy of the same
abstraction the repo extracts into a package.

## Decision

Create `@sdxc/file-storage-r2`, exporting one class:

```ts
import { R2FileStorage } from "@sdxc/file-storage-r2";

let storage = new R2FileStorage(env.SOCIAL_CARDS); // FileStorage
```

- **`get`, `has`, `list`, `put`, `remove`, `set`** implement `FileStorage`. `has` uses `HEAD`;
  `list` forwards `prefix`, `cursor` and `limit`, returns a `cursor` only while R2 reports the
  listing truncated, and asks R2 for metadata only when `includeMetadata` is set.
- **A file's name and `lastModified`** are stored as custom metadata and its type as the
  object's content type, so a file reads back as it was written. An object written without them
  reads back named by its key and dated by its upload time.
- **The bucket is typed structurally** (`R2FileBucket`: `get`, `head`, `list`, `put`,
  `delete`), so the package typechecks in any project, including one that compiles it with no
  Workers types loaded. Every `R2Bucket`, from `wrangler types` or `@cloudflare/workers-types`,
  satisfies it.
- **`get` answers a native `File`**, read whole into memory, so the result works anywhere a
  `File` does, `new Response(file)` included.
- **Tests run in the Workers pool** against a real R2 binding declared in the
  `packages-workers` project.

Each app keeps only its `socialCards()` function, which binds the class to its own bucket.

## Consequences

### Positive

- **One implementation.** A fix to the adapter reaches both apps through one release.
- **Checked against R2 itself.** The paging and metadata behavior is asserted on workerd's
  bucket implementation.

### Negative

- **A file body is buffered** with `arrayBuffer()` on read and write, which suits the
  image-sized files it stores today and not multi-hundred-megabyte uploads.

## Alternatives Considered

### 1. Keep the class in each app

**Rejected because**: two identical copies drift the first time one app fixes a bug in its own.

### 2. Put the adapter in `@sdxc/cloudflare-mocks` or another existing package

**Rejected because**: none of them is a runtime `remix/file-storage` adapter; a storage adapter
gets its own package, as the KV session storage and the D1 data-table driver do.

### 3. Type the bucket as `R2Bucket` imported from `@cloudflare/workers-types`

**Rejected because**: that module declares its own copies of `ReadableStream`, `Headers` and
the other web types, so a binding typed by `wrangler types` is never assignable to it. The
global `R2Bucket` works in a Worker, and fails in any project without Workers types loaded.

### 4. Answer `get` with a `LazyFile` from `remix/lazy-file`

**Rejected because**: it streams from R2 correctly, with range requests for slices, but a
`LazyFile` satisfies `File` only through a cast where Bun's types add `json()`, `image()` and
`formData()` to `File`, and `new Response(file)` throws on one. Image-sized files gain little
from streaming.

## References

- [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
