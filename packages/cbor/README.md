# @sdxc/cbor

CBOR (RFC 8949) decoding and deterministic encoding, bounded for untrusted input.

## Installation

```sh
npm add @sdxc/cbor
```

Decoding and encoding answer a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs alongside this package.

## Usage

### Decode and encode

```typescript
import * as CBOR from "@sdxc/cbor";
import { isFailure } from "@sdxc/result";

let decoded = CBOR.decode(Uint8Array.of(0xa1, 0x61, 0x61, 0x83, 0x01, 0x02, 0x03));
if (isFailure(decoded)) throw decoded.error; // decoded.error.code, decoded.error.offset
decoded.data; // Map { "a" => [1, 2, 3] }

let bytes = CBOR.encode(new Map([["a", [1, 2, 3]]])); // success(Uint8Array [0xa1, 0x61, …])
```

[CBOR](https://www.rfc-editor.org/rfc/rfc8949) items map to JavaScript values one way only:

| CBOR                         | JavaScript                                             |
| ---------------------------- | ------------------------------------------------------ |
| unsigned, negative integer   | `number`, or `bigint` beyond `Number.MAX_SAFE_INTEGER` |
| bignum (tags 2 and 3)        | `bigint`                                               |
| byte string                  | `Uint8Array`, copied out of the input                  |
| text string                  | `string`, refused unless valid UTF-8                   |
| array                        | `Array`                                                |
| map                          | `Map`, so integer and byte-string keys keep their type |
| any other tag                | `Tagged`, with `tag` and `value`                       |
| false, true, null, undefined | `false`, `true`, `null`, `undefined`                   |
| other simple values          | `Simple`, with `value`                                 |
| float                        | `number`                                               |

### Read untrusted input within limits

```typescript
import * as CBOR from "@sdxc/cbor";

let result = CBOR.decode(body, { maxDepth: 8, maxItems: 1_000 });
```

Every item costs at least one byte, so a document can only claim lengths its own bytes hold; `maxDepth` (default 64) and `maxItems` (default 100,000) bound the nesting and the number of values one input allocates. A failure is `limit-exceeded`.

### Require deterministic encoding

```typescript
import * as CBOR from "@sdxc/cbor";

let result = CBOR.decode(signedPayload, { deterministic: true });
```

The [core deterministic encoding requirements](https://www.rfc-editor.org/rfc/rfc8949#section-4.2.1): shortest arguments, definite lengths, the shortest float that holds a value, map keys in bytewise order of their encodings, and bignums only beyond 64 bits. Anything else fails `not-deterministic`. `encode` always writes this form.

## API

### `decode(bytes: Uint8Array, options?: DecodeOptions): Result<CBORValue, CBORError>`

The one data item `bytes` holds. Bytes after it fail `trailing-bytes`; a map key equal to an earlier one fails `duplicate-key`, including keys JavaScript cannot tell apart, such as `1` and `1.0`.

- `options.maxDepth`: Deepest nesting of arrays, maps and tags. Default 64.
- `options.maxItems`: Most data items, nested ones included. Default 100,000.
- `options.deterministic`: Refuse any encoding deterministic CBOR rules out. Default `false`.

### `decodeFirst(bytes: Uint8Array, options?: DecodeOptions): Result<DecodedPrefix, CBORError>`

The first data item of `bytes` and the number of bytes it took, for formats that place an item before other data with no length in front of it.

```typescript
let { value, length } = unwrap(CBOR.decodeFirst(bytes));
let rest = bytes.subarray(length);
```

### `encode(value: CBORValue): Result<Uint8Array, CBORError>`

`value` as deterministic CBOR, so equal values always produce identical bytes. A safe integer becomes a CBOR integer and any other number the shortest float holding it exactly, so `1.0` encodes as `1` and `-0` as a half-precision float. A cycle, a lone surrogate, a plain object or a function fails `unencodable`; two map keys with the same encoding fail `duplicate-key`.

### `Tagged`

`new Tagged(tag, value)`: a tag number up to 2^64 − 1 and the item it encloses. The tag's meaning is yours to apply.

### `Simple`

`new Simple(value)`: a simple value with no JavaScript equivalent, 0 to 19 or 32 to 255.

### `CBORError`

The failure every function reports.

- `code`: `"truncated"`, `"malformed"`, `"trailing-bytes"`, `"duplicate-key"`, `"limit-exceeded"`, `"not-deterministic"` or `"unencodable"`.
- `offset`: the byte where the failing item starts, for a decoding failure; `undefined` for an encoding one.

### Types

#### `CBORValue`

Every value `decode` returns and `encode` accepts, as the table above lists.

#### `DecodeOptions`

`{ maxDepth?, maxItems?, deterministic? }`, as `decode` describes.

#### `DecodedPrefix`

`{ value, length }`: the decoded item and the bytes its encoding took.

## Patterns

### Pattern: Hash a value the same way every time

Deterministic encoding gives a structured value one byte form, so its digest identifies it.

```typescript
import * as CBOR from "@sdxc/cbor";
import { isFailure, success } from "@sdxc/result";

async function fingerprint(value: CBOR.CBORValue) {
	let bytes = CBOR.encode(value);
	if (isFailure(bytes)) return bytes;
	let digest = await crypto.subtle.digest("SHA-256", bytes.data);
	return success(new Uint8Array(digest));
}
```

`new Map([["b", 1], ["a", 2]])` and `new Map([["a", 2], ["b", 1]])` produce the same digest, because map keys are written in sorted order.

### Pattern: Read a COSE key out of a binary record

A WebAuthn authenticator data record carries a CBOR public key after fixed-length fields, with nothing saying where the key ends.

```typescript
import * as CBOR from "@sdxc/cbor";
import { isFailure } from "@sdxc/result";

function readCredentialKey(authenticatorData: Uint8Array, keyOffset: number) {
	let key = CBOR.decodeFirst(authenticatorData.subarray(keyOffset), { maxDepth: 4 });
	if (isFailure(key)) return key;
	if (!(key.data.value instanceof Map)) return null;
	return {
		algorithm: key.data.value.get(3), // COSE "alg" label
		bytes: authenticatorData.subarray(keyOffset, keyOffset + key.data.length),
	};
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
		"@sdxc/cbor": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
