---
title: Encode and decode CBOR
description: Accept and answer application/cbor bodies within limits, store values in a deterministic byte form, read a passkey's COSE key and sign payloads with COSE_Sign1.
section:
    title: HTTP APIs
    order: 5
order: 12
lastUpdated: 2026-10-25
outcomes:
    - "How to read an `application/cbor` request body within limits and answer in CBOR"
    - "Why deterministic encoding gives a value one byte form you can hash, store and sign"
    - "How to read a passkey's COSE public key and sign a payload with COSE_Sign1"
---

CBOR is JSON's binary sibling: the same maps, arrays, strings and numbers, plus byte strings,
integers beyond 2^53 and tags, written in fewer bytes and read without a text parser. It is
what small devices send, what WebAuthn authenticators answer with, and the format COSE
signatures are built on. This guide adds an endpoint that takes readings from devices as
`application/cbor`, stores each one under the hash of its bytes, reads the COSE key a passkey
holds, and signs a payload so another service can check it.

[`@sdxc/cbor`](/api/cbor) decodes with bounds on depth and item count, so a hostile body
cannot make the Worker allocate without limit, and always encodes in the deterministic form,
so equal values produce identical bytes. Its `@sdxc/cbor/cose` entry handles COSE keys and
COSE_Sign1 messages with WebCrypto keys. Every call answers with a
[`@sdxc/result`](/api/result). [`@sdxc/validate`](/api/validate) checks the decoded fields and
[`@sdxc/crypto`](/api/crypto) writes the hashes and keys as text.

```bash
npm add @sdxc/cbor @sdxc/crypto @sdxc/result @sdxc/validate remix
```

## Map CBOR to JavaScript

Each CBOR item decodes to one JavaScript form, and `encode` turns that form back into CBOR:

| CBOR                       | JavaScript                                             |
| -------------------------- | ------------------------------------------------------ |
| unsigned, negative integer | `number`, or `bigint` beyond `Number.MAX_SAFE_INTEGER` |
| byte string                | `Uint8Array`                                           |
| text string                | `string`, valid UTF-8 only                             |
| array                      | `Array`                                                |
| map                        | `Map`, so integer and byte-string keys keep their type |
| any other tag              | `Tagged`, with `tag` and `value`                       |
| float                      | `number`                                               |

A map decodes to a `Map` because CBOR keys may be integers or bytes, as COSE's are. `encode`
takes a `Map` for the same reason and fails `unencodable` on a plain object, so build maps
with `new Map([...])`.

```typescript {% title="app/services/cbor-example.ts" %}
import * as CBOR from "@sdxc/cbor";
import { unwrap } from "@sdxc/result";

let bytes = unwrap(CBOR.encode(new Map([["values", [21.5, 22]]])));
unwrap(CBOR.decode(bytes)); // Map { "values" => [21.5, 22] }
```

## Declare the endpoint

The route contract names the URL the controller below is mapped to.

```typescript {% title="routes/api.ts" %}
import { post, route } from "remix/routes";

export default route({
	api: {
		readings: {
			create: post("/api/readings"),
		},
	},
});
```

## Validate the decoded fields

A decoded body is a `CBORValue`, which says nothing yet about which members it has. Copy the
text-keyed members of the map into an object and check it with a `remix/data-schema` schema,
the same way a JSON body is checked:

```typescript {% title="app/http/validators/readings.ts" %}
import type { CBORValue } from "@sdxc/cbor";
import type { InferOutput } from "remix/data-schema";

import { failure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";

export const READING = s.object({
	device: s.string(),
	at: s.number(),
	values: s.array(s.number()),
});

export type Reading = InferOutput<typeof READING>;

export async function readReading(value: CBORValue) {
	if (!(value instanceof Map))
		return failure(new TypeError("A reading is a CBOR map."));

	let fields: Record<string, CBORValue> = {};
	for (let [key, field] of value) {
		if (typeof key === "string") fields[key] = field;
	}
	return validate(fields, READING);
}
```

## Accept an `application/cbor` body

The controller checks the media type and the declared size before it reads anything, then
decodes with limits sized for what a reading can hold: a map holding an array is two levels
deep, and a thousand items is more than any reading carries.

```typescript {% title="app/http/controllers/api/readings/create.ts" %}
import * as CBOR from "@sdxc/cbor";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { readReading } from "~/app/http/validators/readings";
import { storeReading } from "~/app/models/readings";
import routes from "~/routes/api";

const MAX_BODY_BYTES = 16 * 1024;

function cbor(value: CBOR.CBORValue, status = 200): Response {
	let bytes = CBOR.encode(value);
	if (isFailure(bytes)) return new Response(null, { status: 500 });
	return new Response(bytes.data, {
		status,
		headers: { "Content-Type": "application/cbor" },
	});
}

export default createAction(routes.api.readings.create, async (ctx) => {
	let type = ctx.request.headers.get("Content-Type");
	if (type !== "application/cbor") {
		return new Response(null, {
			status: 415,
			headers: { Accept: "application/cbor" },
		});
	}
	let length = Number(ctx.request.headers.get("Content-Length") ?? "0");
	if (length > MAX_BODY_BYTES) return new Response(null, { status: 413 });

	let body = new Uint8Array(await ctx.request.arrayBuffer());
	let decoded = CBOR.decode(body, { maxDepth: 4, maxItems: 1_000 });
	if (isFailure(decoded)) {
		let { code, offset } = decoded.error;
		return cbor(
			new Map<string, CBOR.CBORValue>([
				["error", code],
				["offset", offset ?? null],
			]),
			400,
		);
	}

	let reading = await readReading(decoded.data);
	if (isFailure(reading)) return cbor(new Map([["error", "invalid-reading"]]), 422);

	let id = await storeReading(reading.data);
	if (isFailure(id)) return cbor(new Map([["error", id.error.message]]), 500);
	return cbor(new Map([["id", id.data]]), 201);
});
```

A failure carries a `code` (`truncated`, `malformed`, `trailing-bytes`, `duplicate-key`,
`limit-exceeded`) and the `offset` of the byte where the failing item starts, so the device's
developer sees where their encoder went wrong. A map that repeats a key fails
`duplicate-key`, including keys JavaScript cannot tell apart, such as `1` and `1.0`, so a
reading cannot carry two `device` members that a second parser would read differently.

<warning>
`maxDepth` (64 by default) and `maxItems` (100,000) bound what one body allocates, and every
item costs at least one byte, so a body can only claim lengths its own bytes hold. The body
size is still yours to bound: a request sent chunked has no `Content-Length`, so put the
endpoint behind a limit at the edge too when devices you do not control call it.
</warning>

[Build a JSON API with problem details](/docs/http-apis/json-apis) answers failures as
problem documents; a CBOR API that serves both kinds of client can answer them there and keep
CBOR for successes.

## Store a value under its hash

`encode` always writes deterministic CBOR: shortest integers, definite lengths, the shortest
float that holds the value exactly, and map keys sorted by their encoded bytes. Two equal
readings therefore produce the same bytes and the same SHA-256, so the hash is an id that
makes a resent reading land on the record it already wrote.

```typescript {% title="app/models/readings.ts" %}
import type { Reading } from "~/app/http/validators/readings";

import * as CBOR from "@sdxc/cbor";
import { Hex, sha256 } from "@sdxc/crypto";
import { isFailure, success } from "@sdxc/result";
import { env } from "cloudflare:workers";

export async function storeReading(reading: Reading) {
	let bytes = CBOR.encode(
		new Map<CBOR.CBORValue, CBOR.CBORValue>([
			["device", reading.device],
			["at", reading.at],
			["values", reading.values],
		]),
	);
	if (isFailure(bytes)) return bytes;

	let digest = await sha256(bytes.data);
	if (isFailure(digest)) return digest;
	let id = Hex.encode(digest.data);
	await env.READINGS.put(`reading:${id}`, bytes.data);
	return success(id);
}

export async function findReading(id: string) {
	let stored = await env.READINGS.get(`reading:${id}`, "arrayBuffer");
	if (stored === null) return success(null);
	return CBOR.decode(new Uint8Array(stored), { deterministic: true });
}
```

Declare `READINGS` as a KV binding with `bindings.kv()` in `cloudflare.config.ts`. A reading
stored this way takes fewer bytes than the same reading as JSON text, and a float stays the
exact double it was rather than a decimal string read back.

`decode(bytes, { deterministic: true })` refuses any encoding the deterministic rules rule out,
with `not-deterministic`. Use it where the bytes themselves are the identity, as here and for a
payload whose signature was made over its encoding.

## Read a passkey's COSE public key

A WebAuthn authenticator hands back its public key as a COSE key: a CBOR map with integer
labels, `1` for the key type, `3` for the algorithm, negative labels for the curve and
coordinates. [`@sdxc/passkey`](/docs/identity-and-security/passkeys) stores that key as
base64url in `publicKey`, and `@sdxc/cbor/cose` reads it, so a settings page can show each
passkey's RFC 9679 thumbprint as a short identifier, or export it as a JWK:

```typescript {% title="app/services/passkeys/thumbprint.ts" %}
import * as CBOR from "@sdxc/cbor";
import * as COSE from "@sdxc/cbor/cose";
import { Base64Url } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";

export async function passkeyThumbprint(publicKey: string) {
	let bytes = Base64Url.decode(publicKey);
	if (isFailure(bytes)) return bytes;
	let key = CBOR.decode(bytes.data, { maxDepth: 4 });
	if (isFailure(key)) return key;
	if (!(key.data instanceof Map)) return failure(new TypeError("Not a COSE key."));

	let thumbprint = await COSE.thumbprint(key.data);
	if (isFailure(thumbprint)) return thumbprint;
	return success(Base64Url.encode(thumbprint.data));
}
```

The thumbprint hashes only the key's required public parameters in deterministic form, so the
same key always has the same thumbprint. `COSE.toJWK(key)` converts the same map to a JWK, and
`COSE.importKey(key)` imports it as a `CryptoKey` for the algorithm its label `3` names.

## Sign a payload with COSE_Sign1

COSE_Sign1 is the CBOR counterpart of a JWS: a protected header, a payload and one signature,
in bytes rather than base64 text. Sign the stored bytes of a reading and a service downstream
can check that this Worker produced them:

```typescript {% title="app/services/readings/receipt.ts" %}
import * as COSE from "@sdxc/cbor/cose";
import { isFailure, success } from "@sdxc/result";

export function signReceipt(payload: Uint8Array, privateKey: CryptoKey) {
	return COSE.sign1({
		protected: new Map([[COSE.HeaderParameter.ALG, COSE.Algorithm.ES256]]),
		payload,
		key: privateKey,
	});
}

export async function readReceipt(message: Uint8Array, publicKey: CryptoKey) {
	let verified = await COSE.verifySign1(message, publicKey);
	if (isFailure(verified)) return verified;
	return success(verified.data.payload);
}
```

The algorithm must sit in the protected header, where the signature covers it, and
`verifySign1` refuses a key imported for any other algorithm, so a message cannot ask to be
checked with a weaker one. Pass `detached: true` to `sign1` to leave the payload out of the
message and `{ payload }` to `verifySign1` to supply it.

<note>
A COSE_Sign1 signature covers the protected header's encoded bytes, so re-encoding a decoded
message keeps those bytes as they arrived. Add to the unprotected header, as a receipt does,
and the signature still verifies.
</note>

## Test the endpoint

A route test sends CBOR through the router the Worker builds. Both cases below are refused
before anything is stored, so they need no KV namespace:

```typescript {% title="app/http/controllers/api/readings/create.test.ts" %}
import * as CBOR from "@sdxc/cbor";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";

function post(body: Uint8Array<ArrayBuffer>) {
	return createWebRouter().fetch(
		new Request("https://sensors.example.com/api/readings", {
			method: "POST",
			headers: { "Content-Type": "application/cbor" },
			body,
		}),
	);
}

test("a truncated body answers 400 with the CBOR error and its offset", async () => {
	let response = await post(Uint8Array.of(0xa1, 0x66));

	expect(response.status).toBe(400);
	let body = unwrap(CBOR.decode(new Uint8Array(await response.arrayBuffer())));
	expect(body).toEqual(
		new Map<CBOR.CBORValue, CBOR.CBORValue>([
			["error", "truncated"],
			["offset", 0],
		]),
	);
});

test("a reading missing its fields answers 422", async () => {
	let bytes = unwrap(CBOR.encode(new Map([["device", "greenhouse-1"]])));

	let response = await post(bytes);

	expect(response.status).toBe(422);
});
```

The happy path writes to KV, so test it in a `*.workers.test.ts` file, where the
`READINGS` binding is a real namespace and `findReading` reads back what the endpoint stored.

## Where to go next

- [Add passkeys](/docs/identity-and-security/passkeys) — the ceremonies that produce the COSE
  keys this guide reads.
- [Build a JSON API with problem details](/docs/http-apis/json-apis) — problem documents for the
  failures a CBOR endpoint answers.
- [`@sdxc/cbor`](/api/cbor) — `decodeFirst` for an item followed by other data, every COSE
  algorithm and error code.
