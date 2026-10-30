---
title: Hash and sign JSON in canonical form
description: Serialize JSON with the RFC 8785 JSON Canonicalization Scheme, so equal values hash, sign and deduplicate to the same bytes whatever their key order.
section:
    title: HTTP APIs
    order: 5
order: 11
lastUpdated: 2026-10-25
outcomes:
    - "Why `JSON.stringify` is the wrong input for a hash or a signature"
    - "How to hash and deduplicate JSON with `@sdxc/json-canonical`"
    - "How to sign a JSON value so a receiver that re-serializes it still verifies"
---

`JSON.stringify` writes members in the order they were inserted, so `{ a: 1, b: 2 }` and
`{ b: 2, a: 1 }` are equal values with different text, and a hash, a signature or an `ETag`
computed from that text differs too. The
[JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785) (JCS) fixes every
choice the serializer makes, so equal values always produce the same bytes. This guide
writes that form with [`@sdxc/json-canonical`](/api/json-canonical) and uses it to
deduplicate documents and sign values that travel as data.

```bash
npm add @sdxc/json-canonical @sdxc/result @sdxc/crypto
```

## Serialize a value canonically

`canonicalize` writes no whitespace, sorts object members at every depth, and writes numbers
and strings exactly as ECMAScript does. Arrays keep their order:

```typescript {% title="app/services/canonical.ts" %}
import { canonicalize } from "@sdxc/json-canonical";

canonicalize({ b: [4.5, "€"], a: { d: true, c: null } });
// success('{"a":{"c":null,"d":true},"b":[4.5,"€"]}')

canonicalize(JSON.parse('{"n": 1E30, "x": 0.000001, "z": -0}'));
// success('{"n":1e+30,"x":0.000001,"z":0}')
```

## Hash a document to deduplicate it

A hash over the canonical bytes names a value rather than one spelling of it. Store it in a
column with a unique index, and a second import of the same document with its keys reordered
is refused instead of stored twice:

```typescript {% title="app/services/content-hash.ts" %}
import { canonicalize } from "@sdxc/json-canonical";
import { Hex, sha256 } from "@sdxc/crypto";
import { isFailure, success } from "@sdxc/result";

export async function contentHash(value: unknown) {
	let canonical = canonicalize(value);
	if (isFailure(canonical)) return canonical;

	let digest = await sha256(canonical.data);
	if (isFailure(digest)) return digest;
	return success(Hex.encode(digest.data));
}
```

## Sign a value that travels as data

A receipt or a grant is stored, embedded in other documents and parsed again, so its text
changes on the way. Sign its canonical form, carry the signature beside it, and verify by
canonicalizing what arrives:

```typescript {% title="app/services/receipts.ts" %}
import { hmac, Hex } from "@sdxc/crypto";
import { canonicalize } from "@sdxc/json-canonical";
import { isFailure, success } from "@sdxc/result";

export interface Receipt {
	id: string;
	customer: string;
	total: string;
	issuedAt: string;
}

export interface SignedReceipt {
	receipt: Receipt;
	signature: string;
}

export async function signReceipt(secret: string, receipt: Receipt) {
	let canonical = canonicalize(receipt);
	if (isFailure(canonical)) return canonical;

	let mac = await hmac.sign(secret, canonical.data);
	if (isFailure(mac)) return mac;
	return success<SignedReceipt>({ receipt, signature: Hex.encode(mac.data) });
}

export async function verifyReceipt(secret: string, signed: SignedReceipt) {
	let canonical = canonicalize(signed.receipt);
	if (isFailure(canonical)) return false;

	let valid = await hmac.verify(secret, canonical.data, signed.signature);
	return !isFailure(valid) && valid.data;
}
```

Read the secret from `env` in the caller and refuse to sign when it is unset. `hmac.verify`
compares in constant time, so a tampered receipt fails closed.

> [!WARNING]
> Canonical form is defined over I-JSON, where numbers are IEEE doubles. An integer above
> 2^53 has already changed when `JSON.parse` reads it, so `9007199254740993` canonicalizes as
> `9007199254740992` and a signature over the original fails. Carry ids, amounts in minor
> units past that range, and other exact values as strings, as `total` does above.

## Handle a value JCS refuses

`canonicalize` fails on anything without one JSON spelling: `NaN`, `undefined`, a cycle, and
any object other than a plain one, `Date` included. The error's `pointer` names the field:

```typescript {% title="app/services/canonical-errors.ts" %}
import { canonicalize } from "@sdxc/json-canonical";
import { isFailure } from "@sdxc/result";

let result = canonicalize({ items: [1, Number.NaN] });
if (isFailure(result)) result.error.pointer; // "/items/1"

canonicalize({ issuedAt: new Date() }); // fails at "/issuedAt"
canonicalize({ issuedAt: new Date().toISOString() }); // succeeds
```

Convert dates to ISO strings and drop `undefined` members before you canonicalize.

## Test the signature

The test that matters is the one `JSON.stringify` would fail: a reordered receipt still
verifies, and a changed total does not.

```typescript {% title="app/services/receipts.test.ts" %}
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { signReceipt, verifyReceipt } from "~/app/services/receipts";

const SECRET = "test-receipt-secret";

test("a reordered receipt verifies and an edited one does not", async () => {
	let signed = unwrap(
		await signReceipt(SECRET, {
			id: "r1",
			customer: "c1",
			total: "10.00",
			issuedAt: "2026-10-24T00:00:00Z",
		}),
	);

	let reordered = JSON.parse(
		'{"total":"10.00","issuedAt":"2026-10-24T00:00:00Z","customer":"c1","id":"r1"}',
	);
	expect(await verifyReceipt(SECRET, { ...signed, receipt: reordered })).toBe(true);

	let edited = { ...signed.receipt, total: "0.00" };
	expect(await verifyReceipt(SECRET, { ...signed, receipt: edited })).toBe(false);
});
```

## Where to go next

- [Idempotent writes and JSON Merge Patch](/docs/http-apis/safe-writes) — the idempotency
  fingerprint compares JSON bodies in this canonical form.
- [Sign and verify HTTP requests](/docs/identity-and-security/http-message-signatures) — sign the
  request itself when the JSON travels as a body.
- [`@sdxc/json-canonical`](/api/json-canonical) — every refused value and the number
  format.
