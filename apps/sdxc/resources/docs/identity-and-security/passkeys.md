---
title: Add passkeys
description: Enroll a passkey for a signed-in account and sign in with it, verifying both WebAuthn ceremonies on the server.
section:
    title: Identity & security
    order: 5
order: 2
lastUpdated: 2026-10-08
---

A passkey is a key pair the person's device holds, bound to your domain, unlocked with a
fingerprint, a face or a PIN. There is nothing to phish and nothing to leak from your
database, because what you store is a public key. This guide adds one to a Remix v3 app:
enrollment for an account that is already signed in, and a sign-in that needs no password.

[`@sdxc/passkey`](/api/passkey) covers both halves. `@sdxc/passkey/server` issues ceremony
options and verifies what the browser signs; `@sdxc/passkey/client` runs the ceremony in the
browser, from a `remix/component` client entry. Every failure on either side is a
[`@sdxc/result`](/api/result) value.

```bash
npm add @sdxc/passkey @sdxc/auth @sdxc/result @sdxc/http @sdxc/ui
```

## Declare the endpoints

Each ceremony is two requests: the server issues a challenge, the browser signs it, the server
verifies the signature. WebAuthn is a browser API, so these are JSON endpoints a client island
talks to rather than form submissions.

A sign-in runs both requests around the authenticator's prompt, and enrollment has the same
shape on the `register` routes:

```mermaid {% alt="Passkey sign-in: the browser island requests a challenge the server keeps in the session, the authenticator signs an assertion, the island posts it to verify, and the server spends the challenge, verifies and records the passkey, regenerates the session with the user id and returns a redirect URL" %}
sequenceDiagram
    participant I as Browser island
    participant S as Server
    participant SS as Session
    participant D as Authenticator
    I->>S: POST /passkeys/sign-in/challenge
    S->>SS: keepChallenge
    S-->>I: Options
    I->>D: Passkey.authenticate(options)
    D-->>I: Signed assertion
    I->>S: POST /passkeys/sign-in/verify
    S->>SS: spendChallenge
    Note over S: Passkeys.find, verifyAuthentication,<br>Passkeys.recordUse
    S->>SS: regenerateId and set userId
    S-->>I: Redirect URL
    Note over I: location.assign(redirect)
```

```typescript {% title="routes/passkeys.ts" %}
import { post, route } from "remix/routes";

export default route({
	register: {
		challenge: post("/passkeys/register/challenge"),
		verify: post("/passkeys/register/verify"),
	},
	signIn: {
		challenge: post("/passkeys/sign-in/challenge"),
		verify: post("/passkeys/sign-in/verify"),
	},
});
```

Nest it under `passkeys` in your route table in `routes/web.ts`, beside the `dashboard` a
sign-in lands on, so the controllers below read `routes.passkeys.signIn.verify` and so on.

## One relying party

The relying party holds your policy and nothing else, so one instance at module scope serves
every request.

```typescript {% title="app/auth/passkeys.ts" %}
import { RelyingParty } from "@sdxc/passkey/server";
import { env } from "cloudflare:workers";

export const RELYING_PARTY = new RelyingParty({
	id: env.PASSKEY_RP_ID,
	name: "Acme",
	origin: env.APP_ORIGIN,
	userVerification: "required",
});
```

`id` is the registrable domain credentials are bound to, such as `example.com`; use the parent
domain when one passkey must cover several subdomains. `origin` lists where a ceremony may run.
`userVerification: "required"` turns a missing biometric or PIN into a verification failure,
which is what you want when the passkey is the only thing a sign-in asks for.

## Keep the challenge between the two requests

The challenge is issued by one request and checked by the next, so it has to outlive the first.
The session is the smallest place that holds it — the one from
[Sign in with OpenID Connect](/docs/identity-and-security/sign-in-with-oidc) works as it is.

```typescript {% title="app/auth/passkey-challenge.ts" %}
import type { RequestContext } from "remix/router";

import { sessionOf } from "@sdxc/auth/remix/context";

const CHALLENGE_KEY = "passkey:challenge";

export function keepChallenge(ctx: RequestContext, challenge: string): void {
	sessionOf(ctx).set(CHALLENGE_KEY, challenge);
}

export function spendChallenge(ctx: RequestContext): string | null {
	let session = sessionOf(ctx);
	let challenge = session.get(CHALLENGE_KEY);
	session.unset(CHALLENGE_KEY);
	return typeof challenge === "string" ? challenge : null;
}
```

`sessionOf` from [`@sdxc/auth`](/api/auth) reads the session Remix's session middleware put on
the context, and throws when that middleware has not run. `spendChallenge` drops the value in
the same call that reads it. A challenge that survives its ceremony is one an attacker can
replay an assertion against; spent on read, it buys exactly one.

## Store what the ceremony proves

Registration answers the row to store, as a `RegisteredPasskey`: the credential `id`, the
`publicKey`, its COSE `algorithm`, the signature `counter`, the `transports`, and whether the
credential is `syncable` and `backedUp`. Authentication later needs `id`, `publicKey` and
`counter` back. Keep them in a table of your own, beside the account id and a `suspended` flag;
the controllers below reach it through a small `Passkeys` repository of yours.

## Enroll a passkey

Enrollment runs for somebody already signed in, because a passkey belongs to an account. That
is also what makes it trustworthy: the account was authenticated when it enrolled, the challenge
was fresh, and the origin and relying party id matched.

```typescript {% title="app/http/controllers/passkeys/register-challenge.ts" %}
import { ok } from "@sdxc/http/response/json";
import { createAction } from "remix/router";

import { currentAccount } from "~/app/auth/current-account";
import { keepChallenge } from "~/app/auth/passkey-challenge";
import { RELYING_PARTY } from "~/app/auth/passkeys";
import { Passkeys } from "~/app/repositories/passkeys";
import routes from "~/routes/web";

export default createAction(routes.passkeys.register.challenge, async (ctx) => {
	let account = await currentAccount(ctx);
	let { challenge, options } = RELYING_PARTY.register({
		user: { id: account.id, name: account.email },
		exclude: await Passkeys.listIds(ctx.db, account.id),
	});

	keepChallenge(ctx, challenge);
	return ok(options);
});
```

`user.id` is stored on the authenticator and comes back on every assertion, and it is readable
on the device, so use your opaque primary key rather than an email. `exclude` lists the
credentials the account already has, so the browser refuses to enroll the same device twice.
`currentAccount` is your own helper that answers the signed-in account's `id` and `email`, and
`Passkeys.listIds` answers the credential ids the account holds.

The verify endpoint hands the request straight to the relying party, which reads and validates
the JSON body itself:

```typescript {% title="app/http/controllers/passkeys/register-verify.ts" %}
import { badRequest, ok } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { currentAccount } from "~/app/auth/current-account";
import { spendChallenge } from "~/app/auth/passkey-challenge";
import { RELYING_PARTY } from "~/app/auth/passkeys";
import { Passkeys } from "~/app/repositories/passkeys";
import routes from "~/routes/web";

export default createAction(routes.passkeys.register.verify, async (ctx) => {
	let challenge = spendChallenge(ctx);
	if (!challenge) return badRequest({ error: "rejected" });

	let result = await RELYING_PARTY.verifyRegistration(ctx.request, { challenge });
	if (isFailure(result)) {
		ctx.log.warn("passkey.registration_rejected", { reason: result.error.name });
		return badRequest({ error: "rejected" });
	}

	let account = await currentAccount(ctx);
	await Passkeys.create(ctx.db, { accountId: account.id, ...result.data });
	return ok({ enrolled: true });
});
```

## Sign in with it

Leaving `allow` out of `authenticate()` makes the ceremony usernameless: the browser offers
every passkey it holds for your domain, so nobody types an identifier first.

```typescript {% title="app/http/controllers/passkeys/sign-in-challenge.ts" %}
import { ok } from "@sdxc/http/response/json";
import { createAction } from "remix/router";

import { keepChallenge } from "~/app/auth/passkey-challenge";
import { RELYING_PARTY } from "~/app/auth/passkeys";
import routes from "~/routes/web";

export default createAction(routes.passkeys.signIn.challenge, (ctx) => {
	let { challenge, options } = RELYING_PARTY.authenticate();
	keepChallenge(ctx, challenge);
	return ok(options);
});
```

Verification needs the stored credential before there is anything to verify against, and the
assertion names it by id, so this endpoint reads the body itself and hands the parsed response
to the relying party:

```typescript {% title="app/http/controllers/passkeys/sign-in-verify.ts" %}
import { sessionOf } from "@sdxc/auth/remix/context";
import { badRequest, ok } from "@sdxc/http/response/json";
import { CounterError } from "@sdxc/passkey/server";
import { isFailure, wrap } from "@sdxc/result";
import { createAction } from "remix/router";

import { spendChallenge } from "~/app/auth/passkey-challenge";
import { RELYING_PARTY } from "~/app/auth/passkeys";
import { Passkeys } from "~/app/repositories/passkeys";
import routes from "~/routes/web";

export default createAction(routes.passkeys.signIn.verify, async (ctx) => {
	let challenge = spendChallenge(ctx);
	let body = await wrap(
		() => ctx.request.json() as Promise<AuthenticationResponseJSON>,
	);
	if (!challenge || isFailure(body)) return badRequest({ error: "rejected" });

	let passkey = await Passkeys.find(ctx.db, body.data.id);
	if (!passkey || passkey.suspended) return badRequest({ error: "rejected" });

	let result = await RELYING_PARTY.verifyAuthentication(body.data, {
		challenge,
		passkey,
	});
	if (isFailure(result)) {
		if (result.error instanceof CounterError)
			await Passkeys.suspend(ctx.db, passkey.id);
		ctx.log.warn("passkey.rejected", { reason: result.error.name });
		return badRequest({ error: "rejected" });
	}

	await Passkeys.recordUse(ctx.db, passkey.id, result.data.counter);
	let session = sessionOf(ctx);
	session.regenerateId?.();
	session.set("userId", passkey.accountId);
	return ok({ redirect: routes.dashboard.href() });
});
```

`AuthenticationResponseJSON` is the browser's own type for what `Passkey.authenticate` posts.
The cast only names that shape: `verifyAuthentication` validates the whole response and answers
a `MalformedResponseError` for anything else, and `wrap` catches a body that is not JSON.
`Passkeys.find` answers the stored `id`, `publicKey` and `counter` the relying party checks
against, with the `accountId` and `suspended` flag beside them. Every refusal answers the same body and is logged by error name, so a caller never learns which
check failed while your logs do. Record the new `counter`: the next assertion has to exceed it,
and a `CounterError` means two devices are presenting the same credential — a cloned
authenticator — so the credential is suspended rather than merely refused. Regenerating the
session id on sign-in keeps the id held while anonymous from becoming the signed-in one, and
`userId` stands for whichever key your app's session marks a signed-in account with.

## Run the ceremony in the browser

The browser half is the one piece of the page that ships JavaScript. Keep the ceremony in a
plain function: fetch the options, prompt, post the signed response, follow the redirect.

```typescript {% title="resources/components/passkey-ceremony.ts" %}
import { CancelledError, Passkey } from "@sdxc/passkey/client";
import { isFailure } from "@sdxc/result";

export async function signInWithPasskey(challengeUrl: string, verifyUrl: string) {
	let issued = await fetch(challengeUrl, { method: "POST" });
	let options = (await issued.json()) as PublicKeyCredentialRequestOptionsJSON;

	let result = await Passkey.authenticate(options);
	if (isFailure(result)) {
		return result.error instanceof CancelledError ? null : result.error.message;
	}

	let verified = await fetch(verifyUrl, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(result.data),
	});
	if (!verified.ok) return "That passkey was not accepted.";

	let { redirect } = (await verified.json()) as { redirect: string };
	location.assign(redirect);
	return null;
}
```

A `CancelledError` means the person dismissed the prompt, which deserves silence rather than an
error message. The island wraps it in a button and shows whatever message comes back:

```tsx {% title="resources/components/passkey-sign-in.tsx" %}
import type { Handle } from "remix/component";

import { Button } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

import { signInWithPasskey } from "./passkey-ceremony";

type PasskeySignInProps = { challengeUrl: string; verifyUrl: string; label: string };

export const PasskeySignIn = clientEntry(
	"/resources/components/passkey-sign-in.tsx#PasskeySignIn",
	function PasskeySignIn(handle: Handle<PasskeySignInProps>) {
		let message: string | null = null;

		async function start() {
			let { challengeUrl, verifyUrl } = handle.props;
			message = await signInWithPasskey(challengeUrl, verifyUrl);
			void handle.update();
		}

		return () => (
			<>
				<Button type="button" mix={[on("click", () => void start())]}>
					{handle.props.label}
				</Button>
				{message && <p role="alert">{message}</p>}
			</>
		);
	},
);
```

Render it beside your other sign-in options, passing
`routes.passkeys.signIn.challenge.href()` and `routes.passkeys.signIn.verify.href()` as the
two URLs; a browser without WebAuthn gets an `UnsupportedError` message from the same button.
How client entries hydrate is covered in
[Build the interface with remix/component](/docs/building-remix-apps/interface-with-remix-ui).

Enrollment is the same shape with `Passkey.register` in place of `Passkey.authenticate`. There,
an `AlreadyRegisteredError` means this device is already enrolled, so point the person at
signing in instead.

To offer passkeys inside the browser's autocomplete menu, mark the identifier field
`autocomplete="username webauthn"` and start `Passkey.autofill(options, { signal: handle.signal })`
when the island mounts. It stays pending until someone picks a credential, and `handle.signal`
aborts it when the island disconnects, which releases the one ceremony a browser keeps open.

## Where to go next

- [Sign in with OpenID Connect](/docs/identity-and-security/sign-in-with-oidc) — the session
  and account these endpoints build on.
- [Security headers and CSP](/docs/identity-and-security/security-headers) — the nonce the
  client-entry import map needs under a strict policy.
- [Build the interface with remix/component](/docs/building-remix-apps/interface-with-remix-ui) —
  client entries and hydration.
- [`@sdxc/passkey`](/api/passkey) — second-factor use, attestation, and every error class.
