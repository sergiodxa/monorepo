---
title: Hash, sign and encrypt with Web Crypto
description: Reset links backed by hashed tokens, scrypt passwords, HMAC-signed links and secrets sealed at rest with AES-GCM.
section:
    title: Identity & security
    order: 5
order: 7
lastUpdated: 2026-09-30
---

Most security code in an app is a handful of primitives used in the right place: a random
token, a digest of it, a signature, a password hash, an encrypted column. This guide builds the
account features that need them: a password-reset link, password storage, a signed unsubscribe
link and secrets encrypted at rest. The TOTP second factor built on the same package has a
guide of its own.

[`@sdxc/crypto`](/api/crypto) wraps the Web Crypto API with the details decided once:
encodings, constant-time comparison, a versioned encryption envelope, scrypt parameters. Every
call that can fail returns a `Result` from [`@sdxc/result`](/api/result), so a refusal from the
runtime is a branch, not an exception.

```bash
npm add @sdxc/crypto @sdxc/result @sdxc/validate @sdxc/http
```

## Pick the primitive by what happens next

What you will do with a value later decides how you store it:

| You need to                             | Use                                 | Because                                                       |
| --------------------------------------- | ----------------------------------- | ------------------------------------------------------------- |
| Find a token again when it is presented | `randomToken`, stored as `sha256`   | a digest is deterministic, so it works as a key               |
| Check a password someone types          | `password.hash` / `password.verify` | scrypt is slow and salted, so a leaked table resists guessing |
| Prove a value you issued is unchanged   | `hmac.sign` / `hmac.verify`         | only the holder of the secret can produce the signature       |
| Read a secret back later                | `seal` / `open`                     | AES-GCM encrypts and detects tampering                        |
| Accept a code from an authenticator app | `totp`                              | RFC 6238, the algorithm those apps implement                  |

## An opaque token for a reset link

A reset link carries a bearer credential: whoever holds the link can set the password. Make
it unguessable with 32 random bytes, and store only its SHA-256 digest, so anyone who reads
your storage finds hashes rather than working links:

```typescript {% title="app/services/password-resets.ts" %}
import { Hex, randomToken, sha256 } from "@sdxc/crypto";
import { isFailure, success } from "@sdxc/result";
import { env } from "cloudflare:workers";

const RESET_TTL_SECONDS = 30 * 60;

async function storageKey(token: string) {
	let digest = await sha256(token);
	if (isFailure(digest)) return digest;
	return success(`reset:${Hex.encode(digest.data)}`);
}

export async function issueReset(userId: string) {
	let token = randomToken({ bytes: 32 });
	let key = await storageKey(token);
	if (isFailure(key)) return key;

	await env.AUTH_TOKENS.put(key.data, userId, { expirationTtl: RESET_TTL_SECONDS });
	return success(token);
}

export async function consumeReset(token: string): Promise<string | null> {
	let key = await storageKey(token);
	if (isFailure(key)) return null;

	let userId = await env.AUTH_TOKENS.get(key.data);
	if (userId !== null) await env.AUTH_TOKENS.delete(key.data);
	return userId;
}
```

`randomToken` returns unpadded base64url, safe in a URL as it is, so the link is
`/password/reset?token=…` with nothing to escape. A plain digest is enough here, where a
password needs scrypt, because the token carries 256 bits of entropy: nobody guesses it, and
the digest only has to keep a reader of the store from using what they read. It also has to be
deterministic, since the presented token is hashed again to find the record.

`consumeReset` deletes the record as it reads it, so a link works once. KV is eventually
consistent, so two clicks landing in different locations within seconds can both find it; keep
the record in D1 or a Durable Object when single use has to be strict. Mail the link as in
[Send email](/docs/data-and-background-work/send-email).

The same shape serves API keys. Give them a prefix, `randomToken({ prefix: "sk" })` for
`sk_…`, so a key pasted into a log or a public repository is recognizable, and a secret
scanner can flag it.

## Store the new password with scrypt

The reset form posts the token and the new password. Validate the form first, so a password
your policy refuses does not spend the link, then consume the token and hash the password:

```tsx {% title="app/http/controllers/password/reset.tsx" %}
import { password } from "@sdxc/crypto";
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";

import { NewPasswordSchema } from "~/app/http/validators/password";
import { Users } from "~/app/repositories/users";
import { consumeReset } from "~/app/services/password-resets";
import { ResetPasswordPage } from "~/resources/views/reset-password";
import routes from "~/routes/web";

export default createAction(routes.password.reset.update, async (ctx) => {
	let form = await validate(ctx.formData, NewPasswordSchema);
	if (isFailure(form)) {
		let page = <ResetPasswordPage issues={form.error.issues} />;
		return ctx.render(page, { status: 400 });
	}

	let userId = await consumeReset(form.data.token);
	if (userId === null) return redirect(routes.password.forgot.href());

	let hash = await password.hash(form.data.password);
	if (isFailure(hash)) {
		ctx.log.fail(hash.error);
		return ctx.render(<ResetPasswordPage failed />, { status: 500 });
	}

	await Users.setPasswordHash(ctx.db, userId, hash.data);
	return redirect(routes.login.href(), { status: redirect.Status.SeeOther });
});
```

`NewPasswordSchema` is your `remix/data-schema` object for the two fields, with the length
rules from [Protect forms from bots and abuse](/docs/identity-and-security/protect-forms).
`password.hash` salts every hash freshly and encodes it as
`$scrypt$ln=15,r=8,p=3$<salt>$<key>`, parameters included. Scrypt has no Web Crypto
equivalent, so this one call runs on `node:crypto`, which needs the `nodejs_compat`
compatibility flag on Workers.

Signing in checks the password against the stored hash, using the parameters that hash
records:

```typescript {% title="app/services/sign-in.ts" %}
import type { Database } from "remix/data-table";

import { password } from "@sdxc/crypto";
import { isFailure, isSuccess } from "@sdxc/result";

import { Users } from "~/app/repositories/users";

export async function checkPassword(db: Database, email: string, secret: string) {
	let user = await Users.findByEmail(db, email);
	if (user === null) return null;

	let valid = await password.verify(user.passwordHash, secret);
	if (isFailure(valid) || !valid.data) return null;

	if (password.needsRehash(user.passwordHash)) {
		let rehashed = await password.hash(secret);
		if (isSuccess(rehashed))
			await Users.setPasswordHash(db, user.id, rehashed.data);
	}
	return user;
}
```

A wrong password is `success(false)`; a failure means the stored value is not a hash this
package wrote, `MalformedHashError`, or names another algorithm, `UnsupportedAlgorithmError`.
Both end in `null` here. `needsRehash` is true when the stored hash is behind the current
parameters, so when those rise, every account moves to them on its next sign-in, with no
migration and no forced reset. An unknown address returns faster than a wrong password, since
nothing is hashed; if that difference matters to you, verify against a fixed hash you
generated once.

## Sign a link with HMAC

An unsubscribe link in an email has to work without a session, and must not let anyone
unsubscribe someone else by editing the query string. Sign what the link says with a secret
only your app holds:

```typescript {% title="app/services/unsubscribe-links.ts" %}
import { Hex, hmac } from "@sdxc/crypto";
import { failure, isFailure, isSuccess, success } from "@sdxc/result";
import { env } from "cloudflare:workers";

export async function unsubscribeUrl(userId: string, list: string) {
	if (!env.LINK_SECRET) return failure(new Error("LINK_SECRET is not set"));

	let signed = await hmac.sign(env.LINK_SECRET, JSON.stringify([userId, list]));
	if (isFailure(signed)) return signed;

	let url = new URL("/unsubscribe", env.APP_ORIGIN);
	let sig = Hex.encode(signed.data);
	url.search = new URLSearchParams({ user: userId, list, sig }).toString();
	return success(url);
}

export async function verifyUnsubscribe(url: URL) {
	if (!env.LINK_SECRET) return null;

	let user = url.searchParams.get("user") ?? "";
	let list = url.searchParams.get("list") ?? "";
	let sig = url.searchParams.get("sig") ?? "";

	let valid = await hmac.verify(env.LINK_SECRET, JSON.stringify([user, list]), sig);
	return isSuccess(valid) && valid.data ? { user, list } : null;
}
```

A missing secret fails closed on both sides: no link is minted and none is accepted.
`hmac.verify` recomputes the signature and compares in constant time, so response timing does
not reveal how much of a forged signature was right, and a `sig` that is not valid hex is a
plain mismatch. Signing the JSON array of the values keeps the payload unambiguous, so
`("a:b", "c")` and `("a", "b:c")` cannot produce the same signature.

This link never expires, which suits an unsubscribe. For one that should, put the expiry in
the signed payload, or issue a [JWT](/docs/identity-and-security/json-web-tokens) when a
different service has to verify it without your secret. Webhooks are the same idea with a
standard around it: [Receive and send webhooks](/docs/identity-and-security/webhooks) uses
[`@sdxc/webhooks`](/api/webhooks), which handles the timestamps, replay checks and secret
rotation.

## Seal secrets at rest

Some secrets must be read back: a TOTP secret, a provider's refresh token, a customer's API
key for a service you call. `seal` encrypts a string with AES-GCM under a key only your Worker
holds. Generate 32 bytes of key material as base64url and store it as a Worker secret:

```bash
openssl rand -base64 32 | tr '+/' '-_' | tr -d '=' | npx wrangler secret put SEAL_KEY
```

Import it once per isolate and seal through one module:

```typescript {% title="app/services/sealing.ts" %}
import { importKey, open, seal } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { env } from "cloudflare:workers";

let key: ReturnType<typeof importKey> | null = null;

export async function sealSecret(plaintext: string) {
	key ??= importKey(env.SEAL_KEY);
	let imported = await key;
	if (isFailure(imported)) return imported;
	return await seal(imported.data, plaintext);
}

export async function openSecret(sealed: string) {
	key ??= importKey(env.SEAL_KEY);
	let imported = await key;
	if (isFailure(imported)) return imported;
	return await open(imported.data, sealed);
}
```

`importKey` accepts 16, 24 or 32 bytes and imports them non-extractable, so code that gets
hold of the `CryptoKey` still cannot read the bytes out. `seal` returns
`v1.<iv>.<ciphertext>`, with a fresh IV each call and GCM's authentication tag inside the
ciphertext. `open` fails with `DecryptionError` when the value was altered or sealed under
another key, and gives the same message for both, so the error tells an attacker nothing.

A fresh IV means sealing the same value twice gives two different strings, so a sealed column
cannot be searched. When a value must be both found and read back, store two columns: its
`sha256` for the lookup, and its sealed form for the read.

## Codes from an authenticator app

The `totp` functions generate a shared secret, build the `otpauth://` URI an authenticator app
scans, and check the six-digit codes it shows. The secret belongs sealed, as in the section
above. [Add two-factor sign-in with TOTP](/docs/identity-and-security/two-factor) builds the
whole flow: enrollment, the code step after the password, replay protection, recovery codes
and turning it off.

## Where to go next

- [Receive and send webhooks](/docs/identity-and-security/webhooks): signed deliveries in
  both directions, with secrets minted by `randomToken` and stored sealed.
- [Add two-factor sign-in with TOTP](/docs/identity-and-security/two-factor): the
  authenticator-app factor, with its secret sealed as above and hashed recovery codes.
- [Add passkeys](/docs/identity-and-security/passkeys): a phishing-resistant sign-in beside
  or instead of passwords.
- [Issue and verify JWTs](/docs/identity-and-security/json-web-tokens): signed tokens a
  different service verifies with your public key.
- [`@sdxc/crypto`](/api/crypto): encodings, digests, `timingSafeEqual` and every error class.
