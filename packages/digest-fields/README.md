# @sdxc/digest-fields

RFC 9530 `Content-Digest` and `Repr-Digest`, plus the RFC 3230 `Digest` header.

Compute, write, read and verify the HTTP digest fields, including the `Want-Content-Digest` and `Want-Repr-Digest` preferences and the legacy `Digest` header that draft-cavage HTTP signatures cover.

## Installation

```sh
npm add @sdxc/digest-fields
```

Every function answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs with this package. Digests run on the [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest).

## Usage

### Digest a body

```typescript
import { digest } from "@sdxc/digest-fields";
import { unwrap } from "@sdxc/result";

let body = new TextEncoder().encode(JSON.stringify({ message: "Hello" }));
let bytes = unwrap(await digest(body, "sha-256")); // Uint8Array(32)
```

### Write the field

```typescript
import { stringify } from "@sdxc/digest-fields";

stringify({ "sha-256": bytes }, "content-digest"); // success("sha-256=:…:")
stringify({ "sha-256": bytes }, "digest"); // success("SHA-256=…")
stringify({ "sha-512": 3, "sha-256": 10 }, "want-content-digest"); // success("sha-512=3, sha-256=10")
```

### Read a field

```typescript
import { parse } from "@sdxc/digest-fields";

parse("sha-256=:X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=:", "content-digest");
// success({ "sha-256": Uint8Array(32) })

parse("SHA-256=X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=", "digest");
// success({ "sha-256": Uint8Array(32) })

parse("sha-512=3, sha-256=10", "want-content-digest");
// success({ "sha-512": 3, "sha-256": 10 })
```

### Verify a received body

```typescript
import { verify } from "@sdxc/digest-fields";
import { isFailure } from "@sdxc/result";

let checked = await verify(request.headers, await request.bytes(), { field: "content-digest" });
if (isFailure(checked)) return new Response(checked.error.message, { status: 400 });
```

## API

### `digest(bytes: BinaryLike, algorithm: DigestAlgorithm): Promise<Result<Uint8Array, DigestError>>`

Hashes a body with `sha-256` or `sha-512`. `BinaryLike` is `string | Uint8Array | ArrayBuffer`; text is read as UTF-8, so pass the exact bytes sent when the body is not UTF-8 text.

```typescript
let bytes = await digest(body, "sha-256");
// same as
let bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", body));
```

### `parse(value: string, field: DigestField): Result<FieldValues[field], DigestError>`

Reads a field into digest bytes (`content-digest`, `repr-digest`, `digest`) or preference weights from 0 to 10 (`want-content-digest`, `want-repr-digest`), keyed by lowercase algorithm name. The RFC 9530 fields follow the Structured Field grammar of [`@sdxc/structured-fields`](https://www.npmjs.com/package/@sdxc/structured-fields). `Digest` accepts algorithm names in any case, fails on a repeated algorithm, and skips an entry for another algorithm whose value is not base64, such as `UNIXsum=30637`.

### `stringify(value: FieldValues[field], field: DigestField): Result<string, DigestError>`

Writes a field. `Digest` uppercases algorithm names (`SHA-256=…`), the form draft-cavage verifiers read. An empty value answers `""`, meaning "do not send the field".

### `verify(headers: Headers, body: BinaryLike, options: VerifyOptions): Promise<Result<void, DigestError>>`

Checks a body against `options.field`: `content-digest`, `repr-digest` or `digest`. Every `sha-256` and `sha-512` entry must match, so a forged entry next to a valid one still fails; entries for other algorithms are skipped.

### `DIGEST_ALGORITHMS`

`["sha-256", "sha-512"]`, the algorithms `digest` and `verify` compute.

### `DigestError`

The failure every function answers with; `code` says which check failed:

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

#### `DigestField` and `DigestValueField`

`"content-digest" | "repr-digest" | "want-content-digest" | "want-repr-digest" | "digest"`. `DigestValueField` is the three that carry digests.

#### `Digests`, `Preferences` and `FieldValues`

`Record<string, Uint8Array>` and `Record<string, number>`, keyed by lowercase algorithm name. `FieldValues` maps each field to the one it carries.

#### `DigestErrorCode`

The union of `DigestError` codes in the table above.

#### `VerifyOptions`

`{ field: DigestValueField }`.

## Pattern: Signing-Ready Outbound Request

Attach both fields so RFC 9421 and draft-cavage verifiers each find the one their signature covers.

```typescript
import { digest, stringify } from "@sdxc/digest-fields";
import { unwrap } from "@sdxc/result";

let body = new TextEncoder().encode(JSON.stringify({ type: "Create" }));
let digests = { "sha-256": unwrap(await digest(body, "sha-256")) };

let request = new Request("https://inbox.example.com/", {
	method: "POST",
	body,
	headers: {
		"content-type": "application/json",
		"content-digest": unwrap(stringify(digests, "content-digest")),
		digest: unwrap(stringify(digests, "digest")),
	},
});
```

## Pattern: Verifying Whichever Field the Sender Used

Check `Content-Digest` first, fall back to `Digest`, and map each failure to a status.

```typescript
import { verify } from "@sdxc/digest-fields";
import { isFailure } from "@sdxc/result";

async function checkBody(request: Request) {
	let body = await request.bytes();
	let field = request.headers.has("content-digest") ? "content-digest" : "digest";
	let checked = await verify(request.headers, body, { field });
	if (!isFailure(checked)) return body;

	switch (checked.error.code) {
		case "mismatch":
			return new Response("Body does not match its digest", { status: 422 });
		case "crypto":
			return new Response(null, { status: 500 });
		default:
			return new Response(checked.error.message, { status: 400 });
	}
}
```

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

async function respond(request: Request, data: unknown) {
	let body = new TextEncoder().encode(JSON.stringify(data));
	let algorithm = preferred(request);
	let bytes = unwrap(await digest(body, algorithm));

	return new Response(body, {
		headers: { "content-digest": unwrap(stringify({ [algorithm]: bytes }, "content-digest")) },
	});
}
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
