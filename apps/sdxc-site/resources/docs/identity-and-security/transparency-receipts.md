---
title: Publish transparent statements with SCITT
description: Sign a statement about a release, register it with a SCITT Transparency Service, attach the Receipt, and verify a Transparent Statement offline before trusting what it says.
section:
    title: Identity & security
    order: 6
order: 16
lastUpdated: 2026-10-25
outcomes:
    - "How to sign a SCITT Signed Statement about a release with an `@sdxc/jwt` key"
    - "How to register it with a Transparency Service and attach the Receipt"
    - "How to verify a Transparent Statement's issuer, Receipt and subject before using its payload"
---

A signature proves who signed a statement. It cannot prove the signer told everyone the same
thing: a vendor whose key leaks, or who is compelled, can sign a second SBOM for the same
version and show it to one customer only. SCITT closes that gap with a public log. The issuer
signs a statement, a Transparency Service appends it to an append-only Merkle tree and answers
a Receipt, and anyone holding the service's public key checks the statement is in that log
without asking the service again.

This guide signs a statement about each release your app publishes, registers it, ships the
resulting Transparent Statement beside the release, and verifies one on the consuming side.
[`@sdxc/scitt`](/api/scitt) implements SCITT (RFC 9943) and COSE Receipts (RFC 9942) with a
client for the SCITT Reference API, over the COSE support in [`@sdxc/cbor`](/api/cbor).
[`@sdxc/jwt`](/api/jwt) makes the issuer's key pair, and every call answers a `Result` from
[`@sdxc/result`](/api/result).

```bash
npm add @sdxc/cbor @sdxc/cli @sdxc/jwt @sdxc/result @sdxc/scitt
```

## Make an issuer key

The issuer key signs every statement you make, so it is long-lived and kept as a secret. An
`@sdxc/jwt` key pair already has the shape `signStatement` takes. Generate one from a command,
which runs on your machine:

```bash
sdxc make command scitt/key
```

```typescript {% title="app/commands/index.ts" %}
import { command, commands } from "@sdxc/cli";

export default commands({
	scitt: commands({
		key: command({ description: "Print a new SCITT issuer key pair as JSON" }),
	}),
});
```

```typescript {% title="app/commands/scitt/key.ts" %}
import { createCommand, failure, success } from "@sdxc/cli";
import { JWK } from "@sdxc/jwt";
import { isFailure, wrap } from "@sdxc/result";

import commandset from "~/app/commands";

export default createCommand(commandset.scitt.key, async (ctx) => {
	let pair = await JWK.generateKeyPair("ES256");
	let imported = await wrap(() => JWK.importKeyPair(pair));
	if (isFailure(imported)) return failure(imported.error);

	ctx.stdout(JSON.stringify(pair));
	ctx.stderr(`${JSON.stringify(imported.data.jwk)}\n`);
	return success();
});
```

The serialized pair goes to standard output and into the secret; the public JWK goes to
standard error, for you to publish wherever your consumers pin keys:

```bash
sdxc run scitt key > issuer.json
npx wrangler secret put SCITT_ISSUER_KEY < issuer.json
```

The Worker imports it with `JWK.importKeyPair`:

```typescript {% title="app/services/issuer-key.ts" %}
import { JWK } from "@sdxc/jwt";
import { wrap } from "@sdxc/result";
import { env } from "cloudflare:workers";

export function issuerKey() {
	return wrap(() => JWK.importKeyPair(JSON.parse(env.SCITT_ISSUER_KEY)));
}
```

## Sign a statement about a release

A Signed Statement names who says it (`issuer`), what it is about (`subject`) and carries the
claim itself as its payload, here the release's SBOM. A package URL makes a good subject,
since it names one version of one artifact. The issuer and subject travel in the protected
header as CWT claims, so the signature covers them:

```typescript {% title="config/transparency.ts" %}
export const RELEASE_ISSUER = "https://example.com";
export const TRANSPARENCY_ISSUER = "https://transparency.example.com";
```

```typescript {% title="app/services/release-statements.ts" %}
import { isFailure } from "@sdxc/result";
import { signStatement } from "@sdxc/scitt";

import { issuerKey } from "~/app/services/issuer-key";
import { RELEASE_ISSUER } from "~/config/transparency";

export async function signRelease(version: string, sbom: Uint8Array) {
	let key = await issuerKey();
	if (isFailure(key)) return key;

	return await signStatement({
		issuer: RELEASE_ISSUER,
		subject: `pkg:npm/@example/cli@${version}`,
		contentType: "application/spdx+json",
		payload: sbom,
		issuedAt: new Date(),
		key: key.data,
	});
}
```

The answer is the COSE_Sign1 bytes, ready to register. For a payload too large to carry, such
as the release tarball, sign its SHA-256 digest with `detached: true`.

## Register it and attach the Receipt

`TransparencyService` is a client for one service's SCITT Reference API. Build it from the
service's URL and whatever credentials it asks for:

```typescript {% title="app/initializers/transparency-service.ts" %}
import { TransparencyService } from "@sdxc/scitt";
import { env } from "cloudflare:workers";

export function transparencyService() {
	return new TransparencyService(env.TRANSPARENCY_SERVICE_URL, {
		headers: { authorization: `Bearer ${env.TRANSPARENCY_SERVICE_TOKEN}` },
	});
}
```

`submit` posts the statement and, when the service answers `202`, polls until the Receipt is
ready. `attachReceipts` writes the Receipt into the statement's unprotected header, which
leaves the issuer's signature valid, and the result is a Transparent Statement:

```typescript {% title="app/services/transparency.ts" %}
import type { TransparencyService } from "@sdxc/scitt";

import { isFailure } from "@sdxc/result";
import { attachReceipts } from "@sdxc/scitt";

export async function registerStatement(
	service: TransparencyService,
	statement: Uint8Array,
) {
	let receipt = await service.submit(statement);
	if (isFailure(receipt)) return receipt;
	return attachReceipts(statement, [receipt.data]);
}
```

Publish the Transparent Statement beside the release, such as `cli-1.2.3.tgz.scitt` in the
bucket that serves the download. It is self-contained: a consumer needs the service's keys and
your public key, and never calls the service to check it.

> [!NOTE]
> Registration can wait minutes while the service polls, so call `registerStatement` from a
> background job or your release command, never inside a request.

## Verify a Transparent Statement

The consuming side checks three things before using the payload: the issuer's signature, a
Receipt from a service it trusts, and that the statement is about the artifact in hand.
`verifyTransparentStatement` does the first two. The issuer key is the public JWK the key
command printed, pinned in configuration and imported through `@sdxc/cbor/cose`:

```typescript {% title="app/services/verify-release.ts" %}
import type { ReceiptKeys } from "@sdxc/scitt";

import * as COSE from "@sdxc/cbor/cose";
import { failure, isFailure, success } from "@sdxc/result";
import { verifyTransparentStatement } from "@sdxc/scitt";

import { RELEASE_ISSUER, TRANSPARENCY_ISSUER } from "~/config/transparency";

interface ReleaseCheck {
	keys: ReceiptKeys;
	issuerKey: CryptoKey;
	subject: string;
}

export async function importIssuerKey(jwk: JsonWebKey) {
	let key = COSE.fromJWK(jwk);
	if (isFailure(key)) return key;
	return await COSE.importKey(key.data, COSE.Algorithm.ES256);
}

export async function verifyRelease(bytes: Uint8Array, check: ReleaseCheck) {
	let verified = await verifyTransparentStatement(bytes, {
		keys: check.keys,
		issuer: TRANSPARENCY_ISSUER,
		issuerKey: check.issuerKey,
	});
	if (isFailure(verified)) return verified;

	let { statement } = verified.data;
	if (statement.issuer !== RELEASE_ISSUER || statement.subject !== check.subject) {
		return failure(new Error(`The statement is about ${statement.subject}`));
	}
	return success(statement.payload);
}
```

`keys` is the service's key set, which `transparencyService().keys()` reads from
`/.well-known/scitt-keys`, or a single `CryptoKey`. Receipts from services you hold no key for
are skipped, and at least one Receipt must verify.

> [!WARNING]
> A valid statement says only what its issuer claimed about its subject. Compare `subject` with
> the artifact you are about to use, and `issuer` with who you expect: a genuine, logged
> statement about version 1.2.2 is no evidence about 1.2.3.

> [!NOTE]
> The service's keys are the root of trust for every Receipt. Fetch them from the service's own
> origin, cache them, and review a change of key set before accepting it, the same way you would
> pin the issuer's key.

## Test registration and verification

MSW plays the Transparency Service. It answers each registration with a Receipt for a log of
one entry, signed by a key made in the test, so the whole path runs: sign, register, attach,
verify:

```typescript {% title="app/services/transparency.test.ts" %}
import type { CBORValue } from "@sdxc/cbor";

import { encode } from "@sdxc/cbor";
import * as COSE from "@sdxc/cbor/cose";
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import {
	Label,
	leafHash,
	registeredEntry,
	signStatement,
	TransparencyService,
} from "@sdxc/scitt";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";

import { registerStatement } from "~/app/services/transparency";
import { verifyRelease } from "~/app/services/verify-release";
import { RELEASE_ISSUER, TRANSPARENCY_ISSUER } from "~/config/transparency";

const ORIGIN = "https://transparency.example.com";
const SUBJECT = "pkg:npm/@example/cli@1.2.3";
const SBOM = new TextEncoder().encode('{"spdxVersion":"SPDX-2.3"}');
const SERVER = setupServer();

beforeAll(() => SERVER.listen({ onUnhandledRequest: "error" }));
afterEach(() => SERVER.resetHandlers());
afterAll(() => SERVER.close());

async function keyPair() {
	return (await crypto.subtle.generateKey(
		{ name: "ECDSA", namedCurve: "P-256" },
		false,
		["sign", "verify"],
	)) as CryptoKeyPair;
}

async function receiptFor(statement: Uint8Array, key: CryptoKey) {
	let entry = unwrap(registeredEntry(statement));
	let proof = unwrap(encode([1, 0, []]));
	return unwrap(
		await COSE.sign1({
			protected: new Map<CBORValue, CBORValue>([
				[COSE.HeaderParameter.ALG, COSE.Algorithm.ES256],
				[Label.VDS, Label.RFC9162_SHA256],
				[
					COSE.HeaderParameter.CWT_CLAIMS,
					new Map([[Label.ISS, TRANSPARENCY_ISSUER]]),
				],
			]),
			unprotected: new Map([
				[Label.VDP, new Map([[Label.INCLUSION_PROOFS, [proof]]])],
			]),
			payload: await leafHash(entry),
			detached: true,
			key,
		}),
	);
}

test("a registered release verifies for its own subject only", async () => {
	let issuer = await keyPair();
	let service = await keyPair();
	SERVER.use(
		http.post(`${ORIGIN}/entries`, async ({ request }) => {
			let body = new Uint8Array(await request.arrayBuffer());
			return new HttpResponse(await receiptFor(body, service.privateKey), {
				status: 201,
				headers: {
					location: `${ORIGIN}/entries/1`,
					"content-type": "application/cose",
				},
			});
		}),
	);

	let statement = unwrap(
		await signStatement({
			issuer: RELEASE_ISSUER,
			subject: SUBJECT,
			payload: SBOM,
			key: { id: "release-key", alg: "ES256", private: issuer.privateKey },
		}),
	);
	let transparent = unwrap(
		await registerStatement(new TransparencyService(ORIGIN), statement),
	);

	let check = { keys: service.publicKey, issuerKey: issuer.publicKey };
	let sbom = await verifyRelease(transparent, { ...check, subject: SUBJECT });
	expect(isSuccess(sbom) && sbom.data).toEqual(SBOM);

	let other = await verifyRelease(transparent, {
		...check,
		subject: "pkg:npm/@example/cli@1.2.2",
	});
	expect(isFailure(other)).toBe(true);
});
```

A log of one entry has a root equal to the entry's leaf hash, which is why the mock signs
`leafHash(entry)` directly.

## Where to go next

- [Sign files and security.txt with OpenPGP](/docs/identity-and-security/openpgp-signatures)
  — detached signatures `gpg` can check, for consumers who verify with a key alone.
- [Issue and verify JWTs](/docs/identity-and-security/json-web-tokens) — the `@sdxc/jwt` key
  pairs the issuer key is, and how to rotate and publish them.
- [`@sdxc/scitt`](/api/scitt) — `readStatement`, `readReceipt`, `verifyReceipt` and every
  `TransparencyService` method.
