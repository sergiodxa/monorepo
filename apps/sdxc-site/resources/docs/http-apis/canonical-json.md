---
title: Hash and sign JSON in canonical form
description: Serialize JSON with the RFC 8785 JSON Canonicalization Scheme, so equal values hash, sign, tag and deduplicate to the same bytes whatever their key order.
section:
    title: HTTP APIs
    order: 5
order: 11
lastUpdated: 2026-10-25
outcomes:
    - "Why `JSON.stringify` is the wrong input for a hash or a signature"
    - "How to hash, deduplicate and tag JSON with `@sdxc/json-canonical`"
    - "How to sign a JSON value so a receiver that re-serializes it still verifies"
---

`JSON.stringify` writes members in the order they were inserted, so `{ a: 1, b: 2 }` and
`{ b: 2, a: 1 }` are equal values with different text, and a hash, a signature or an `ETag`
computed from that text differs too. The
[JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785) (JCS) fixes every
choice the serializer makes, so equal values always produce the same bytes. This guide
uses those bytes to deduplicate documents, tag responses and sign values that travel as
data.

[`@sdxc/json-canonical`](/api/json-canonical) writes that form and returns a
[`@sdxc/result`](/api/result), [`@sdxc/crypto`](/api/crypto) hashes and signs the bytes, and
[`@sdxc/http`](/api/http) turns them into an `ETag`.

```bash
npm add @sdxc/json-canonical @sdxc/result @sdxc/crypto @sdxc/http remix
```

## Serialize a value canonically

`canonicalize` writes no whitespace, sorts object members by the UTF-16 code units of
their names at every depth, and writes numbers and strings exactly as ECMAScript does.
Arrays keep their order, since order is part of an array's value.

```typescript {% title="app/services/canonical.ts" %}
import { canonicalize } from "@sdxc/json-canonical";

canonicalize({ b: [4.5, "€"], a: { d: true, c: null } });
// success('{"a":{"c":null,"d":true},"b":[4.5,"€"]}')

canonicalize(JSON.parse('{"n": 1E30, "x": 0.000001, "z": -0}'));
// success('{"n":1e+30,"x":0.000001,"z":0}')
```

The output is a string. JCS is defined over its UTF-8 bytes, and `sha256`, `hmac` and
`etag` below accept the string and hash exactly those bytes.

## Hash a document to deduplicate it

A content hash over the canonical bytes names a value rather than one spelling of it. Store
it in a column with a unique index and a second import of the same document, with its keys
in another order, is refused by the database instead of stored twice.

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

The same hash is a cache key for work keyed by its input, such as a rendered report keyed
by its filters, and a stable job id for a payload that must enqueue once.

## Answer with an ETag that follows the data

An `ETag` is strong only when it names the exact bytes sent. Send the canonical text as the
body and hash that text, so the tag and the bytes are one thing, and two isolates that
assembled the same book in a different order answer the same tag.

```typescript {% title="app/http/controllers/api/books/show.ts" %}
import { conditional, etag, Policies } from "@sdxc/http/cache";
import { canonicalize } from "@sdxc/json-canonical";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import Book, { serializeBook } from "~/app/models/book";
import problems from "~/config/problems";
import routes from "~/routes/api";

export default createAction(routes.api.books.show, async (ctx) => {
	let book = await Book.find(ctx.db, ctx.params.bookId);
	if (book === null) return problems.notFound({ detail: "No book has that id." });

	let body = canonicalize({ book: serializeBook(book) });
	if (isFailure(body)) return problems.internal();
	let tag = await etag(body.data);
	if (isFailure(tag)) return problems.internal();

	let headers = new Headers({
		"Cache-Control": Policies.revalidate().toString(),
		"Content-Type": "application/json",
		ETag: tag.data,
	});
	return await conditional(ctx.request, new Response(body.data, { headers }));
});
```

A write that checks `If-Match` computes the tag the same way, so a reordered serializer
never turns a current client into a `412`.

## Sign a value that travels as data

A signature over a raw request body is checked against the bytes received, and
[Receive and send webhooks](/docs/identity-and-security/webhooks) does exactly that. A
receipt, a licence or a grant is different: it is stored in a JSON column, embedded in
another document and parsed again, and its text changes on the way. Sign its canonical
form, carry the signature beside it, and verify by canonicalizing what arrives.

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

Read the secret from `env` in the caller and refuse to sign when it is unset, as
[Hash, sign and encrypt with Web Crypto](/docs/identity-and-security/web-crypto) does for
signed links. `hmac.verify` compares in constant time and answers `false` for a signature
that is not hex, so a tampered receipt fails closed.

<warning>
Canonical form is defined over I-JSON, where numbers are IEEE doubles. An integer above
2^53 has already changed when `JSON.parse` reads it, so `9007199254740993` canonicalizes as
`9007199254740992` and a signature over the original fails. Carry ids, amounts in minor
units past that range, and other exact values as strings, as `total` does above.
</warning>

## Handle a value JCS refuses

`canonicalize` fails on anything without one JSON spelling: `NaN`, `Infinity`, a lone
surrogate, `undefined`, a sparse array hole, a cycle, and any object other than a plain
one, `Date` included. The `CanonicalJsonError` carries a JSON Pointer to the offending
value, so the failure names the field.

```typescript {% title="app/services/canonical-errors.ts" %}
import { canonicalize } from "@sdxc/json-canonical";
import { isFailure } from "@sdxc/result";

let result = canonicalize({ items: [1, Number.NaN] });
if (isFailure(result)) result.error.pointer; // "/items/1"

canonicalize({ note: undefined }); // fails at "/note"
canonicalize({ issuedAt: new Date() }); // fails at "/issuedAt"
canonicalize({ issuedAt: new Date().toISOString() }); // succeeds
```

<note>
`JSON.stringify` drops an `undefined` member and calls a `Date`'s `toJSON`, so a value it
accepts can still fail here. Convert dates to ISO strings and drop optional members that
are `undefined` before you canonicalize, the way your serializer already does for the
response.
</note>

## Test the signature

The test that matters is the one `JSON.stringify` would fail: a receipt that comes back
with its members in another order still verifies, and a changed total does not.

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
