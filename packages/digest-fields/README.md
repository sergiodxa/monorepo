# @sdxc/digest-fields

RFC 9530 `Content-Digest`, `Repr-Digest` and their `Want-*` preferences, plus the RFC 3230 `Digest` header that draft-cavage HTTP signatures cover.

## Installation

```sh
npm add @sdxc/digest-fields
```

Every function answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs with this package. Digests run on the [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest).

## Usage

```typescript
import { digest, stringify, verify } from "@sdxc/digest-fields";
import { isFailure, unwrap } from "@sdxc/result";

let body = new TextEncoder().encode(JSON.stringify(activity));
let bytes = unwrap(await digest(body, "sha-256"));

let headers = new Headers({
	"content-digest": unwrap(stringify({ "sha-256": bytes }, "content-digest")), // "sha-256=:…:"
	digest: unwrap(stringify({ "sha-256": bytes }, "digest")), // "SHA-256=…"
});

let checked = await verify(request.headers, await request.bytes(), { field: "content-digest" });
if (isFailure(checked)) return new Response(checked.error.message, { status: 400 });
```

Reading a field into its value model:

```typescript
import { parse } from "@sdxc/digest-fields";

parse("sha-256=:X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=:", "content-digest");
// success({ "sha-256": Uint8Array(32) })

parse("sha-512=3, sha-256=10", "want-content-digest");
// success({ "sha-512": 3, "sha-256": 10 })
```

## API

### `digest(bytes: BinaryLike, algorithm: DigestAlgorithm): Promise<Result<Uint8Array, DigestError>>`

Hashes a body with `sha-256` or `sha-512`. Text is read as UTF-8, so pass the exact bytes sent when the body is not UTF-8 text.

```typescript
let bytes = await digest(body, "sha-256");
// same as
let bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", body));
```

### `parse(value: string, field: DigestField): Result<FieldValues[field], DigestError>`

Reads a field into digest bytes (`content-digest`, `repr-digest`, `digest`) or preference weights from 0 to 10 (`want-content-digest`, `want-repr-digest`), keyed by lowercase algorithm name. The RFC 9530 fields go through the Structured Field grammar of [`@sdxc/structured-fields`](https://www.npmjs.com/package/@sdxc/structured-fields). `Digest` accepts algorithm names in any case, and drops an entry for another algorithm whose value is not base64, such as `UNIXsum=30637`.

### `stringify(value: FieldValues[field], field: DigestField): Result<string, DigestError>`

Writes a field. `Digest` uppercases algorithm names (`SHA-256=…`), which is how every draft-cavage verifier reads them. An empty value answers `""`, meaning "do not send the field".

### `verify(headers: Headers, body: BinaryLike, options: { field: DigestValueField }): Promise<Result<void, DigestError>>`

Checks a body against `content-digest`, `repr-digest` or `digest`. Every `sha-256` and `sha-512` entry must match, so a forged entry next to a valid one still fails, and entries for other algorithms are skipped.

### `DIGEST_ALGORITHMS`

`["sha-256", "sha-512"]`, the algorithms `digest` and `verify` compute.

### `DigestError`

The failure every function answers with. `code` says which check failed:

| `code`                  | When                                                           |
| ----------------------- | -------------------------------------------------------------- |
| `missing`               | `verify` found no such field                                   |
| `malformed`             | The field text does not fit its grammar                        |
| `invalid`               | `stringify` got a name the field cannot carry or a bad weight  |
| `unsupported-algorithm` | No `sha-256`/`sha-512` entry to check, or `digest` got another |
| `mismatch`              | The body differs from a digest                                 |
| `crypto`                | The runtime refused the hash                                   |

### Types

#### `DigestAlgorithm`

`"sha-256" | "sha-512"`.

#### `DigestField`

`"content-digest" | "repr-digest" | "want-content-digest" | "want-repr-digest" | "digest"`. `DigestValueField` is the three that carry digests.

#### `Digests` and `Preferences`

`Record<string, Uint8Array>` and `Record<string, number>`, keyed by lowercase algorithm name. `FieldValues` maps each field to the one it carries.

## Pattern: Answering `Want-Content-Digest`

Send the algorithm the client weighs highest, falling back to `sha-256`.

```typescript
import { DIGEST_ALGORITHMS, digest, parse, stringify } from "@sdxc/digest-fields";
import { isSuccess, unwrap } from "@sdxc/result";

function preferred(request: Request) {
	let wanted = parse(request.headers.get("want-content-digest") ?? "", "want-content-digest");
	if (!isSuccess(wanted)) return "sha-256";
	let weights = wanted.data;
	let ranked = DIGEST_ALGORITHMS.filter((name) => (weights[name] ?? 0) > 0);
	ranked.sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0));
	return ranked[0] ?? "sha-256";
}

let body = new TextEncoder().encode(JSON.stringify(data));
let algorithm = preferred(request);
let bytes = unwrap(await digest(body, algorithm));

return new Response(body, {
	headers: { "content-digest": unwrap(stringify({ [algorithm]: bytes }, "content-digest")) },
});
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/digest-fields": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
