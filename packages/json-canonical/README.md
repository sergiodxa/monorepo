# @sdxc/json-canonical

RFC 8785 JSON Canonicalization Scheme: one byte-exact serialization for hashing and signing JSON.

`JSON.stringify` writes members in insertion order, so two equal objects can produce different
text and different hashes. The [JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)
(JCS) fixes every choice: no whitespace, object members sorted by the UTF-16 code units of their
names at every depth, and numbers and strings written exactly as ECMAScript writes them. Input
must be [I-JSON](https://www.rfc-editor.org/rfc/rfc7493): no `NaN`, `Infinity` or lone surrogates.

## Installation

```sh
npm add @sdxc/json-canonical
```

Fallible calls return [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values.

## Usage

```typescript
import { canonicalize } from "@sdxc/json-canonical";

canonicalize({ b: [4.5, "€"], a: { d: true, c: null } });
// success('{"a":{"c":null,"d":true},"b":[4.5,"€"]}')

canonicalize(JSON.parse('{"n": 1E30, "x": 0.000001}'));
// success('{"n":1e+30,"x":0.000001}')
```

### Refused input

```typescript
import { canonicalize } from "@sdxc/json-canonical";
import { isFailure } from "@sdxc/result";

let result = canonicalize({ price: NaN });
if (isFailure(result)) result.error.pointer; // "/price"
```

## API

### `canonicalize(value: unknown): Result<string, CanonicalJsonError>`

The canonical JSON text of `value`. Encode it with `TextEncoder` before hashing or signing, as
RFC 8785 specifies UTF-8. Plain objects (including `Object.create(null)`), arrays, strings, finite
numbers, booleans and `null` are accepted; `-0` is written `0`.

### `CanonicalJsonError`

The failure for `NaN`, `Infinity`, a lone surrogate in a string or member name, `undefined`, a
sparse array hole, a cycle, or any value other than the JSON types above. `pointer` is the RFC 6901
JSON Pointer to the offending value.

## Pattern: Hash A JSON Document

```typescript
import { canonicalize } from "@sdxc/json-canonical";
import { unwrap } from "@sdxc/result";

async function digest(value: unknown): Promise<string> {
	let bytes = new TextEncoder().encode(unwrap(canonicalize(value)));
	let hash = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

(await digest({ a: 1, b: 2 })) === (await digest({ b: 2, a: 1 })); // true
```

## Pattern: Sign A Payload Both Sides Can Re-Serialize

The sender signs the canonical bytes and sends the JSON in any form; the receiver parses it,
canonicalizes again and verifies against the same bytes.

```typescript
import { canonicalize } from "@sdxc/json-canonical";
import { isFailure } from "@sdxc/result";

async function verify(body: string, signature: ArrayBuffer, key: CryptoKey): Promise<boolean> {
	let canonical = canonicalize(JSON.parse(body));
	if (isFailure(canonical)) return false;
	let bytes = new TextEncoder().encode(canonical.data);
	return crypto.subtle.verify("Ed25519", key, signature, bytes);
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
		"@sdxc/json-canonical": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
