---
title: Hash, sign and encrypt with Web Crypto
description: Reset links backed by hashed tokens, scrypt passwords, HMAC-signed links and secrets sealed at rest with AES-GCM.
section:
    title: Identity & security
    order: 6
order: 7
lastUpdated: 2026-10-25
outcomes:
    - "How to pick the Web Crypto primitive by what happens to the value next"
    - "How to build reset links from hashed tokens and store passwords with scrypt"
    - "How to sign links with HMAC and seal secrets at rest with AES-GCM"
---

Most security code in an app is a handful of primitives used in the right place: a random
token, a digest of it, a signature, a password hash, an encrypted column. This guide builds the
account features that need them: a password-reset link, password storage, a signed unsubscribe
link and secrets encrypted at rest. [`@sdxc/crypto`](/api/crypto) wraps the Web Crypto API with
the encodings, constant-time comparison and parameters decided once, and returns a `Result` from
every call that can fail.

```bash
npm add @sdxc/crypto @sdxc/http @sdxc/result @sdxc/validate remix
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

The last row has a guide of its own:
[Add two-factor sign-in with TOTP](/docs/identity-and-security/two-factor).

## Mint an opaque token for a reset link

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

`randomToken` returns unpadded base64url, so the link is `/password/reset?token=…` with nothing
to escape. A plain digest is enough here, where a password needs scrypt, because the token
carries 256 bits of entropy. `consumeReset` deletes the record as it reads it, so a link works
once.

> [!WARNING]
> KV is eventually consistent, so two clicks landing in different locations within seconds can
> both find the record. Keep it in D1 or a Durable Object when single use has to be strict.

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
import { Users } from "~/app/models/users";
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

`NewPasswordSchema` is your `remix/data-schema` object for the two fields. `password.hash`
salts every hash freshly and records its parameters in the encoded string.

> [!NOTE]
> Scrypt has no Web Crypto equivalent, so `password.hash` and `password.verify` run on
> `node:crypto`, which needs the `nodejs_compat` compatibility flag on Workers.

Signing in checks the password against the stored hash:

```typescript {% title="app/services/sign-in.ts" %}
import type { Database } from "remix/data-table";

import { password } from "@sdxc/crypto";
import { isFailure, isSuccess } from "@sdxc/result";

import { Users } from "~/app/models/users";

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

A wrong password is `success(false)`, and a stored value this package cannot read is a failure;
both end in `null`. `needsRehash` is true when the stored hash is behind the current
parameters, so every account moves to new ones on its next sign-in.

> [!NOTE]
> An unknown address returns faster than a wrong password, since nothing is hashed, which tells a
> caller timing the response which addresses have accounts. When that matters, verify against a
> fixed hash you generated once before returning `null`.

## Sign a link with HMAC

An unsubscribe link has to work without a session, and must not let anyone unsubscribe someone
else by editing the query string. Sign what the link says with a secret only your app holds:

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
`hmac.verify` compares in constant time, so response timing reveals nothing about a forged
signature. Signing the JSON array of the values keeps the payload unambiguous, so
`("a:b", "c")` and `("a", "b:c")` cannot produce the same signature. This link never expires;
for one that should, put the expiry in the signed payload.

## Seal secrets at rest

Some secrets must be read back: a TOTP secret, a provider's refresh token. `seal` encrypts a
string with AES-GCM under a key only your Worker holds. Declare `SEAL_KEY: bindings.secret()`
in `cloudflare.config.ts`, generate 32 bytes of key material as base64url, and set it for
production:

```bash
openssl rand -base64 32 | tr '+/' '-_' | tr -d '='
bunx cf workers secrets update SEAL_KEY
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

`importKey` imports the key non-extractable, so code that gets hold of the `CryptoKey` still
cannot read the bytes out. `open` fails with `DecryptionError` when the value was altered or
sealed under another key. Each seal uses a fresh IV, so a sealed column matches no lookup: when
a value must be both found and read back, also store its `sha256`.

> [!WARNING]
> A sealed value opens only under the key that sealed it. Replacing `SEAL_KEY` without first
> resealing every stored value under the new key leaves each of them unreadable.

## Test the signed link and the seal

Set `LINK_SECRET`, `APP_ORIGIN` and `SEAL_KEY` in `app/test/cloudflare-workers.ts`, then check
that an edited link is refused and that a sealed value opens back to itself:

```typescript {% title="app/services/unsubscribe-links.test.ts" %}
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { openSecret, sealSecret } from "~/app/services/sealing";
import { unsubscribeUrl, verifyUnsubscribe } from "~/app/services/unsubscribe-links";

test("refuses a link whose user was edited", async () => {
	let url = unwrap(await unsubscribeUrl("user-1", "news"));
	expect(await verifyUnsubscribe(url)).toEqual({ user: "user-1", list: "news" });

	url.searchParams.set("user", "user-2");
	expect(await verifyUnsubscribe(url)).toBeNull();
});

test("opens what it sealed", async () => {
	let sealed = unwrap(await sealSecret("refresh-token"));

	expect(sealed).not.toContain("refresh-token");
	expect(unwrap(await openSecret(sealed))).toBe("refresh-token");
});
```

## Where to go next

- [Receive and send webhooks](/docs/identity-and-security/webhooks) — signed deliveries in
  both directions, with secrets minted by `randomToken` and stored sealed.
- [Add two-factor sign-in with TOTP](/docs/identity-and-security/two-factor) — the
  authenticator-app factor, with its secret sealed as above and hashed recovery codes.
- [`@sdxc/crypto`](/api/crypto) — encodings, digests, `timingSafeEqual` and every error class.
