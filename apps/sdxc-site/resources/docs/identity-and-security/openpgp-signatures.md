---
title: Sign files and security.txt with OpenPGP
description: Make an OpenPGP signing key, serve a cleartext-signed security.txt, publish detached signatures beside your downloads, and verify a file someone else signed.
section:
    title: Identity & security
    order: 6
order: 15
lastUpdated: 2026-10-25
outcomes:
    - "How to make an OpenPGP signing key GnuPG can verify against"
    - "How to serve a cleartext-signed `security.txt` and sign files with detached signatures"
    - "How to verify a detached signature against a pinned certificate before trusting a file"
---

A checksum beside a download proves the bytes arrived intact; it proves nothing about who put
them there, since whoever can replace the file can replace the checksum. An OpenPGP signature
proves the file came from the holder of one private key, and anyone with `gpg` and your public
key can check it without talking to your server. RFC 9116 recommends the same for
`security.txt`, so a researcher can trust the contact address a compromised page could
otherwise rewrite.

This guide makes a signing key, serves a signed `security.txt`, signs the files your app
publishes, and verifies a file a vendor signed before your app uses it.
[`@sdxc/openpgp`](/api/openpgp) implements RFC 9580 signing and verification on Web Crypto, so
it runs unchanged in a Worker. [`@sdxc/well-known`](/api/well-known) serves `security.txt`
and signs it through `@sdxc/openpgp`, and every call answers a `Result` from
[`@sdxc/result`](/api/result).

```bash
npm add @sdxc/cli @sdxc/logger @sdxc/openpgp @sdxc/result @sdxc/well-known remix
```

## Make a signing key

`generateKey` makes an Ed25519 signing key with its self-signatures. The default is a version 6
key, the RFC 9580 format; GnuPG 2.2 and other RFC 4880 tools read only version 4 keys, so pass
`version: 4` whenever people will verify with `gpg`. Generate it from a command, which runs on
your machine rather than in the Worker:

```bash
sdxc make command openpgp/key
```

```typescript {% title="app/commands/index.ts" %}
import { command, commands, flag } from "@sdxc/cli";

export default commands({
	openpgp: commands({
		key: command({
			description: "Print a new OpenPGP signing key, armored",
			flags: {
				userId: flag.string("user-id", {
					description: "Who the key belongs to, as Name <email>",
				}),
			},
		}),
	}),
});
```

```typescript {% title="app/commands/openpgp/key.ts" %}
import { createCommand, failure, success } from "@sdxc/cli";
import { generateKey } from "@sdxc/openpgp";
import { isFailure } from "@sdxc/result";

import commandset from "~/app/commands";

export default createCommand(commandset.openpgp.key, async (ctx) => {
	let key = await generateKey({ userId: ctx.flags.userId, version: 4 });
	if (isFailure(key)) return failure(key.error);

	ctx.stdout(key.data.armor());
	ctx.stderr(`Fingerprint: ${key.data.fingerprint}\n\n`);
	ctx.stderr(key.data.publicKey.armor());
	return success();
});
```

The private key goes to standard output, so it lands in the secret without touching the
terminal, and the fingerprint and public key go to standard error for you to publish:

```bash
sdxc run openpgp key --user-id "Security <security@example.com>" > signing.key
npx wrangler secret put OPENPGP_SIGNING_KEY < signing.key
```

> [!NOTE]
> Store the Worker's copy without a passphrase and let the secret store protect it: unlocking a
> protected key runs many hashing rounds by design, each time the key is read. Keep the
> passphrase-protected copy (`key.lock(passphrase)`) for the backup you keep offline.

## Sign security.txt

`cleartextSigner` from `@sdxc/well-known/security-txt` is a body transform for `serve`: it
wraps the file in an OpenPGP cleartext signature, so the text stays readable and the signature
follows it:

```typescript {% title="app/initializers/router.tsx" %}
import { currentLog } from "@sdxc/logger";
import { serve, wellKnown } from "@sdxc/well-known/middleware";
import { cleartextSigner, securityTxt } from "@sdxc/well-known/security-txt";
import { env } from "cloudflare:workers";
import { createRouter } from "remix/router";

import { SECURITY_TXT } from "~/config/security-txt";

export function createWebRouter() {
	return createRouter({
		middleware: [
			wellKnown({
				"security.txt": serve(securityTxt, () => SECURITY_TXT, {
					transform: cleartextSigner({
						key: () => env.OPENPGP_SIGNING_KEY,
						onError: (error) =>
							currentLog()?.warn("security_txt.unsigned", {
								code: error.code,
							}),
					}),
				}),
			}),
		],
	});
}
```

Without a key, or with one it cannot read or use, the file is served unsigned and `onError`
says why, so a missing secret in a preview environment never takes the contact address
offline. [Security headers and CSP](/docs/identity-and-security/security-headers)
writes the `SECURITY_TXT` document itself.

> [!NOTE]
> RFC 9116 asks a signed file to carry a `Canonical` field naming where it lives, so a signed
> copy served from another address is recognisable as moved. Keep `canonical` filled in.

## Publish detached signatures beside your files

A detached signature travels in its own file, conventionally the file's name plus `.asc`, so
the signed file stays byte for byte what it was. `signDetached` answers both the binary
packet and the armored `PGP SIGNATURE` block; the armored one is what `gpg --verify` reads:

```typescript {% title="app/services/releases.ts" %}
import { readPrivateKey, signDetached } from "@sdxc/openpgp";
import { isFailure, success } from "@sdxc/result";
import { env } from "cloudflare:workers";

export async function publishRelease(name: string, bytes: Uint8Array) {
	let key = await readPrivateKey(env.OPENPGP_SIGNING_KEY);
	if (isFailure(key)) return key;

	let signature = await signDetached(bytes, key.data);
	if (isFailure(signature)) return signature;

	await env.RELEASES.put(name, bytes);
	await env.RELEASES.put(`${name}.asc`, signature.data.armored, {
		httpMetadata: { contentType: "application/pgp-signature" },
	});
	return success({ name, fingerprint: key.data.fingerprint });
}
```

Whoever downloads `app.tar.gz` and `app.tar.gz.asc` checks them with your public key:

```bash
gpg --import security.pub.asc
gpg --verify app.tar.gz.asc app.tar.gz
```

## Verify a file someone else signed

The other direction is a file your app consumes: a vendor's data export, a blocklist, a
firmware image. Pin the vendor's public key in your configuration, the way you would pin a
certificate, and accept the file only once a signature from that key verifies:

```typescript {% title="config/vendor-key.ts" %}
export const VENDOR_PUBLIC_KEY = `-----BEGIN PGP PUBLIC KEY BLOCK-----

…
-----END PGP PUBLIC KEY BLOCK-----`;
```

```typescript {% title="app/services/signed-download.ts" %}
import type { PublicKey } from "@sdxc/openpgp";

import { verifyDetached } from "@sdxc/openpgp";
import { isFailure, success, wrap } from "@sdxc/result";

export async function signedDownload(url: string, certificate: PublicKey) {
	let file = await wrap(() =>
		fetch(url).then((response) => response.arrayBuffer()),
	);
	if (isFailure(file)) return file;
	let signature = await wrap(() => fetch(`${url}.asc`).then((r) => r.text()));
	if (isFailure(signature)) return signature;

	let bytes = new Uint8Array(file.data);
	let verified = await verifyDetached(bytes, signature.data, certificate);
	if (isFailure(verified)) return verified;
	return success({ bytes, signedBy: verified.data.signingKey });
}
```

The caller reads the pinned key once with `readPublicKey(VENDOR_PUBLIC_KEY)` and passes it in.
`verifyDetached` accepts one certificate or a list, so a key rotation is a second entry in the
list until the old key retires. A signature by a revoked or expired key answers
`invalid-signature`, and one from a key you did not pass answers `unknown-signer`.

> [!WARNING]
> Treat `unknown-signer` and `invalid-signature` as a refusal, never as a reason to fall back
> to the unsigned file. A verifier that accepts a file when the signature is missing protects
> nothing, since an attacker who can replace the file can also delete the `.asc`.

`verifyCleartext(text, certificate)` checks a cleartext message, such as another site's
`security.txt`. Only the `text` it returns is covered by the signature, so read the fields from
that.

## Test signing and verifying

A key generated in the test signs and verifies end to end. MSW serves the vendor's file and
its signature, so the download path runs as it does in production:

```typescript {% title="app/services/signed-download.test.ts" %}
import {
	generateKey,
	readPublicKey,
	signDetached,
	verifyCleartext,
} from "@sdxc/openpgp";
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { cleartextSigner, stringify } from "@sdxc/well-known/security-txt";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";

import { signedDownload } from "~/app/services/signed-download";
import { SECURITY_TXT } from "~/config/security-txt";

const SERVER = setupServer();
const BLOCKLIST_URL = "https://vendor.example.com/blocklist.json";

beforeAll(() => SERVER.listen({ onUnhandledRequest: "error" }));
afterEach(() => SERVER.resetHandlers());
afterAll(() => SERVER.close());

test("accepts the vendor's file and refuses a changed one", async () => {
	let key = unwrap(
		await generateKey({ userId: "Vendor <ops@vendor.example.com>" }),
	);
	let certificate = unwrap(await readPublicKey(key.publicKey.armor()));
	let file = new TextEncoder().encode('["203.0.113.7"]');
	let signature = unwrap(await signDetached(file, key));

	SERVER.use(
		http.get(BLOCKLIST_URL, () => HttpResponse.text('["203.0.113.8"]')),
		http.get(`${BLOCKLIST_URL}.asc`, () => HttpResponse.text(signature.armored)),
	);
	let changed = await signedDownload(BLOCKLIST_URL, certificate);
	expect(isFailure(changed) && changed.error.code).toBe("invalid-signature");

	SERVER.use(http.get(BLOCKLIST_URL, () => HttpResponse.arrayBuffer(file.buffer)));
	let accepted = await signedDownload(BLOCKLIST_URL, certificate);
	expect(isSuccess(accepted) && accepted.data.signedBy).toBe(key.fingerprint);
});

test("security.txt verifies against the published key", async () => {
	let key = unwrap(await generateKey({ version: 4 }));
	let sign = cleartextSigner({ key: () => key.armor() });
	let signed = await sign(stringify(SECURITY_TXT));

	let certificate = unwrap(await readPublicKey(key.publicKey.armor()));
	let verified = unwrap(await verifyCleartext(signed, certificate));
	expect(verified.text).toBe(stringify(SECURITY_TXT));
});
```

## Where to go next

- [Publish transparent statements with SCITT](/docs/identity-and-security/transparency-receipts)
  — a public, append-only record of what you signed, for releases that need more than a key.
- [Security headers and CSP](/docs/identity-and-security/security-headers) — the
  `security.txt` document this guide signs, and the headers it sits beside.
- [`@sdxc/openpgp`](/api/openpgp) — key generation options, `verifyKey`, armor and packets.
