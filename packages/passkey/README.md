# @sdxc/passkey

Passkeys on both sides: a one-call WebAuthn browser API, and a relying party that verifies the ceremonies.

## Installation

```bash
npm add @sdxc/passkey
```

Failures come back as [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values, so install that too if you want to import its type guards.

## Usage

### Register a passkey

A passkey belongs to an account, so registration runs for somebody already signed in. The server issues options and a challenge: keep the challenge, send the options.

```typescript
import { RelyingParty } from "@sdxc/passkey/server";

let rp = new RelyingParty({ id: "example.com", name: "Example" });

let { challenge, options } = rp.register({
	user: { id: "usr_8fk2p", name: "ana@example.com" },
});
```

`user` describes the account to whoever is looking at the prompt, and only two fields are required:

- `id` is stored on the authenticator as the user handle and comes back on every assertion, which is how a usernameless sign-in finds the account. Use the opaque primary key you already have — it is readable on the device, so an email here leaks one.
- `name` is what the browser lists the credential under. An email or username is the usual choice; it never has to be unique to the package.
- `displayName` is an optional friendlier label shown beside `name`, such as the person's full name. It falls back to `name`.

Pass `exclude` as well when the account already has passkeys, so enrolling the same device twice is refused by the browser rather than by you:

```typescript
let { challenge, options } = rp.register({
	user: { id: account.id, name: account.email },
	exclude: account.passkeys.map((passkey) => passkey.id),
});
```

The browser runs the ceremony and hands back JSON to post:

```typescript
import { Passkey } from "@sdxc/passkey/client";
import { isFailure } from "@sdxc/result";

let result = await Passkey.register(options);
if (isFailure(result)) return showMessage(result.error.message);

await fetch("/passkeys", { method: "POST", body: JSON.stringify(result.data) });
```

The server verifies it and gets the row to store:

```typescript
import { isFailure } from "@sdxc/result";

let result = await rp.verifyRegistration(request, { challenge });
if (isFailure(result)) return unauthorized(result.error.message);

await db.passkeys.insert({ accountId: account.id, ...result.data });
```

### Sign in with a passkey

Leave `allow` out and the browser offers every passkey it holds for the site, so nobody has to type an identifier first:

```typescript
let { challenge, options } = rp.authenticate();
```

```typescript
let result = await Passkey.authenticate(options);
```

Look the credential up by the id the assertion reports, then verify against it:

```typescript
let passkey = await db.passkeys.find(response.id);

let result = await rp.verifyAuthentication(response, { challenge, passkey });
if (isFailure(result)) return unauthorized(result.error.message);

await db.passkeys.update(passkey.id, { counter: result.data.counter });
```

### Offer passkeys in the sign-in field

`autofill` waits inside the browser's autocomplete menu instead of opening a sheet, so it runs as the page loads and resolves only if somebody picks a credential:

```typescript
if (await Passkey.isAutofillSupported()) {
	let result = await Passkey.autofill(options);
	if (isSuccess(result)) form.submit();
}
```

Pair it with `<input autocomplete="username webauthn">`. A later `register` or `authenticate` call cancels it, because a browser keeps only one ceremony open at a time.

## API

### `@sdxc/passkey/client`

#### `Passkey.register(options, ceremony?)`

Runs `navigator.credentials.create()` against options the server issued, and returns the response as JSON. Resolves to `Result<RegistrationResponseJSON, PasskeyError>`.

#### `Passkey.authenticate(options, ceremony?)`

Runs `navigator.credentials.get()` and prompts immediately. Resolves to `Result<AuthenticationResponseJSON, PasskeyError>`.

#### `Passkey.autofill(options, ceremony?)`

The same ceremony under conditional mediation: the browser offers credentials in an input's autofill menu and the promise stays pending until one is chosen.

#### `Passkey.cancel()`

Aborts the ceremony currently open. Call it when the person leaves the sign-in step, so a pending autofill prompt releases the browser's one ceremony slot.

#### `Passkey.isSupported()`

Whether this page can run a ceremony at all — false on an insecure origin as well as on a browser without WebAuthn.

#### `Passkey.isAutofillSupported()` · `Passkey.isPlatformSupported()`

Whether the browser can offer passkeys through autofill, and whether the device holds one behind a biometric or PIN. Both resolve to `false` rather than rejecting.

Every ceremony call takes an optional `{ signal }` to cancel it alongside the package's own.

### `@sdxc/passkey/server`

#### `new RelyingParty(options)`

- `id` — the registrable domain credentials are bound to, such as `"example.com"`. Use the parent domain when one credential must cover subdomains.
- `name` — the name shown in the passkey prompt.
- `origin` — origin, or origins, allowed to run ceremonies. Defaults to the `https` origin of `id`.
- `userVerification` — `"required"` makes a missing biometric or PIN a verification failure. Defaults to `"preferred"`.
- `algorithms` — COSE algorithms offered, in preference order. Defaults to ES256, RS256 and EdDSA.
- `timeout` — milliseconds the browser keeps the prompt open. Defaults to `300000`.
- `allowFramed` — whether a ceremony may run inside a cross-origin frame. Defaults to `false`, so an embedded frame cannot register or spend a credential for your domain.

The instance is stateless, so keep one at module scope.

#### `rp.register(options)`

Returns `{ challenge, options }` synchronously. Takes `user` (`{ id, name, displayName? }`), and optionally `exclude`, `residentKey`, `attachment` and `userVerification`. Throws `RangeError` if `user.id` does not fit in a 64-byte user handle.

#### `rp.verifyRegistration(response, { challenge, userVerification? })`

Takes the response, or the `Request` carrying it as JSON. Resolves to `Result<RegisteredPasskey, PasskeyError>`, where the success value is the row to store:

```typescript
interface RegisteredPasskey {
	id: string;
	publicKey: string;
	algorithm: number;
	counter: number;
	transports: string[];
	aaguid: string;
	attestation: string;
	userVerified: boolean;
	syncable: boolean;
	backedUp: boolean;
}
```

#### `rp.authenticate(options?)`

Returns `{ challenge, options }` synchronously. Takes `allow` and `userVerification`; leaving `allow` out starts a usernameless ceremony.

#### `rp.verifyAuthentication(response, { challenge, passkey, userVerification? })`

`passkey` is the stored `{ id, publicKey, counter }`. Resolves to `Result<AuthenticatedPasskey, PasskeyError>`:

```typescript
interface AuthenticatedPasskey {
	id: string;
	counter: number;
	userHandle: string | null;
	userVerified: boolean;
	backedUp: boolean;
}
```

Record `counter`: the next assertion has to exceed it.

### Errors

Every failure is an instance of `PasskeyError`, so one check covers them all. The subclasses say which step refused, and each one is exported from the entry point that can produce it.

From the client: `UnsupportedError`, `CancelledError` (the prompt was dismissed — usually deserves silence), `AlreadyRegisteredError` (this device is already enrolled, so send them to sign in), `InvalidOptionsError`, `CeremonyError`.

From the server: `MalformedResponseError`, `ChallengeMismatchError`, `OriginMismatchError`, `CrossOriginError`, `RelyingPartyMismatchError`, `AttestationError`, `UserPresenceError`, `UserVerificationError`, `CredentialMismatchError`, `SignatureError`, `CounterError`, `UnsupportedAlgorithmError`.

## Pattern: a Remix sign-in flow

Four pieces: the routes, one relying party, two endpoints, and one client island. Registration is the same shape with `register` in place of `authenticate`.

### The routes

WebAuthn is a browser API, so the two ceremony steps are `POST` endpoints the island talks to rather than form submissions.

```typescript
import { form, get, post, route } from "remix/routes";

export default route({
	signIn: form("/sign-in"),
	dashboard: get("/dashboard"),

	passkey: {
		/** Issues a challenge and the options the browser prompts with. */
		challenge: post("/passkey/challenge"),
		/** Verifies the assertion and opens the session. */
		verify: post("/passkey/verify"),
	},
});
```

### The relying party

The instance is stateless, so it lives at module scope. The challenge it issues has to outlive the request that issued it, and the session is the smallest place that holds one.

```typescript
import { RelyingParty } from "@sdxc/passkey/server";
import { env } from "cloudflare:workers";
import { getContext } from "remix/middleware/async-context";
import { Session } from "remix/session";

export const RELYING_PARTY = new RelyingParty({
	id: env.RP_ID,
	name: "Example",
	origin: env.APP_ORIGIN,
});

/** Session key the in-flight challenge is parked under. */
const CHALLENGE_KEY = "passkey:challenge";

/**
 * The current request's session.
 *
 * @throws When the session middleware did not run for this request.
 */
function session(): Session {
	let value = getContext().get(Session);
	if (!value) throw new Error("No session in context: the session middleware did not run.");
	return value;
}

/** Parks a challenge until the browser answers it. */
export function keepChallenge(challenge: string): void {
	session().set(CHALLENGE_KEY, challenge);
}

/**
 * Reads the in-flight challenge and drops it in the same call, so one challenge
 * buys exactly one ceremony and a replay of the same assertion finds nothing.
 */
export function spendChallenge(): string | null {
	let value = session();
	let challenge = value.get(CHALLENGE_KEY);
	value.unset(CHALLENGE_KEY);
	return typeof challenge === "string" ? challenge : null;
}
```

### The endpoints

Issuing a challenge is the whole first endpoint. Leaving `allow` out is what makes the prompt usernameless: the browser offers every passkey it holds for the site, so nobody types an identifier.

```tsx
import { createAction } from "remix/router";

import { keepChallenge, RELYING_PARTY } from "~/app/services/passkey";
import routes from "~/routes/web";

/** POST /passkey/challenge — starts a usernameless ceremony. */
export default createAction(routes.passkey.challenge, () => {
	let { challenge, options } = RELYING_PARTY.authenticate();
	keepChallenge(challenge);
	return Response.json(options);
});
```

Verification reads the body itself, because the credential has to be found by the id the assertion carries before there is anything to verify against. Refusals are answered identically and logged by error name, so the response never tells a caller which check refused it.

```tsx
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import Passkey from "~/app/data/passkey";
import { RELYING_PARTY, spendChallenge } from "~/app/services/passkey";
import { openSession } from "~/app/services/session";
import routes from "~/routes/web";

/** POST /passkey/verify — accepts an assertion and signs the account in. */
export default createAction(routes.passkey.verify, async (ctx) => {
	let challenge = spendChallenge();
	if (!challenge) return Response.json({ error: "rejected" }, { status: 400 });

	let response = (await ctx.request.json()) as AuthenticationResponseJSON;

	let passkey = await Passkey.findByCredentialId(ctx.db, response.id);
	if (!passkey) return Response.json({ error: "rejected" }, { status: 400 });

	let result = await RELYING_PARTY.verifyAuthentication(response, { challenge, passkey });
	if (isFailure(result)) {
		ctx.log.warn("passkey.rejected", { reason: result.error.name });
		return Response.json({ error: "rejected" }, { status: 400 });
	}

	await Passkey.recordUse(ctx.db, passkey.id, result.data.counter);
	await openSession(passkey.accountId);

	return Response.json({ redirect: routes.dashboard.href() });
});
```

Register both in the router alongside every other route:

```typescript
router.map(routes.passkey.challenge, challenge);
router.map(routes.passkey.verify, verify);
```

### The island

The one component on the page that ships JavaScript. Its body runs once at hydration, which is where the autofill ceremony starts; `handle.signal` aborts when the component is disconnected, so navigating away releases the browser's single ceremony slot.

```tsx
import type { Handle } from "remix/ui";

import { CancelledError, Passkey } from "@sdxc/passkey/client";
import { isFailure } from "@sdxc/result";
import { clientEntry, on } from "remix/ui";

/**
 * Declared as a `type` to satisfy the serializable-props constraint a client
 * entry's props are checked against.
 */
type PasskeySignInProps = {
	challengeUrl: string;
	verifyUrl: string;
	label: string;
};

/**
 * Signs in with a passkey, offering one through autofill as the page loads and
 * through an explicit button for anyone whose browser skips the autofill menu.
 */
export const PasskeySignIn = clientEntry(
	"/resources/components/passkey-sign-in.tsx#PasskeySignIn",
	function PasskeySignIn(handle: Handle<PasskeySignInProps>) {
		let message: string | null = null;

		/** Fetches options, runs one ceremony, and posts the assertion back. */
		async function signIn(autofill: boolean) {
			let { challengeUrl, verifyUrl } = handle.props;
			let options = await fetch(challengeUrl, { method: "POST" }).then((body) => body.json());

			let result = autofill
				? await Passkey.autofill(options, { signal: handle.signal })
				: await Passkey.authenticate(options);

			if (isFailure(result)) {
				if (result.error instanceof CancelledError) return;
				message = result.error.message;
				return void handle.update();
			}

			let verified = await fetch(verifyUrl, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(result.data),
			});

			if (!verified.ok) {
				message = "That passkey was not accepted.";
				return void handle.update();
			}

			let { redirect } = (await verified.json()) as { redirect: string };
			location.assign(redirect);
		}

		void signIn(true);

		return () => (
			<>
				<button type="button" mix={[on("click", () => void signIn(false))]}>
					{handle.props.label}
				</button>
				{message && <p role="alert">{message}</p>}
			</>
		);
	},
);

export default PasskeySignIn;
```

The view renders it beside an identifier field marked for the autofill menu, so the browser knows where to offer the credential:

```tsx
<form method="post" action={routes.signIn.action.href()}>
	<input type="text" name="email" autocomplete="username webauthn" />
	<PasskeySignIn
		challengeUrl={routes.passkey.challenge.href()}
		verifyUrl={routes.passkey.verify.href()}
		label="Sign in with a passkey"
	/>
</form>
```

Nothing above is required for the password path to keep working: the island is additive, and a browser without WebAuthn renders a button whose `Passkey.authenticate` returns `UnsupportedError` and shows the message.

### Registering, in the same shape

The challenge endpoint names the account instead of leaving it out, and the verify endpoint inserts rather than looks up. Because nothing has to be found by credential id first, this one can hand the request straight over:

```tsx
/** POST /passkey/register/challenge — enrolls a passkey for the signed-in account. */
export default createAction(routes.passkey.register.challenge, async (ctx) => {
	let account = await currentAccount(ctx);

	let { challenge, options } = RELYING_PARTY.register({
		user: { id: account.id, name: account.email },
		exclude: await Passkey.listIds(ctx.db, account.id),
	});

	keepChallenge(challenge);
	return Response.json(options);
});
```

```tsx
/** POST /passkey/register/verify — stores the new credential. */
export default createAction(routes.passkey.register.verify, async (ctx) => {
	let challenge = spendChallenge();
	if (!challenge) return Response.json({ error: "rejected" }, { status: 400 });

	let result = await RELYING_PARTY.verifyRegistration(ctx.request, { challenge });
	if (isFailure(result)) {
		ctx.log.warn("passkey.registration_rejected", { reason: result.error.name });
		return Response.json({ error: "rejected" }, { status: 400 });
	}

	let account = await currentAccount(ctx);
	await Passkey.create(ctx.db, { accountId: account.id, ...result.data });

	return Response.json({ redirect: routes.dashboard.href() });
});
```

## Pattern: keeping the challenge between the two calls

A challenge is issued by one request and verified by the next, so it has to outlive the first. Anywhere you can read it back keyed to the pending ceremony works — a session, a short-lived row, a signed cookie:

```typescript
let { challenge, options } = rp.authenticate();
session.set("passkeyChallenge", challenge);
return Response.json(options);
```

```typescript
let challenge = session.get("passkeyChallenge");
session.unset("passkeyChallenge");

let result = await rp.verifyAuthentication(request, { challenge, passkey });
```

Clear it as soon as it is read: a challenge that survives its ceremony is one an attacker can replay against.

## Pattern: passkeys as a second factor

Register with `userVerification: "required"` and check the same on the way back, so the assertion proves the biometric and not just the device:

```typescript
let account = await db.accounts.find(session.get("accountId"));

let { challenge, options } = rp.authenticate({
	allow: account.passkeys.map((passkey) => ({ id: passkey.id, transports: passkey.transports })),
	userVerification: "required",
});
```

```typescript
let result = await rp.verifyAuthentication(request, {
	challenge,
	passkey,
	userVerification: "required",
});
```

Passing the stored `transports` is what lets the browser skip straight to the right prompt instead of asking how to connect.

## Pattern: telling the person what happened

The error classes map to the four answers a sign-in form actually has:

```typescript
import { AlreadyRegisteredError, CancelledError, UnsupportedError } from "@sdxc/passkey/client";
import { isFailure } from "@sdxc/result";

let result = await Passkey.register(options);

if (isFailure(result)) {
	if (result.error instanceof CancelledError) return;
	if (result.error instanceof AlreadyRegisteredError) return goToSignIn();
	if (result.error instanceof UnsupportedError) return offerAnotherMethod();
	return showMessage(result.error.message);
}
```

## Attestation

Every statement that arrives is verified, and one that cannot be is refused. Registration fails closed.

- `none` is what browsers substitute whenever a relying party asks for no attestation, which is what this package asks for. Its statement must be empty; a `none` carrying anything is an `AttestationError`.
- `packed` self-attestation is signed by the credential's own key. It is verified, which proves possession of the private half at enrollment, and it needs nothing external.
- Anything carrying a certificate chain — `packed` with `x5c`, `tpm`, `android-key`, `apple` — is refused with an `AttestationError`.

That last one is a deliberate limit rather than an oversight. A chain is only worth checking against a set of roots you trust, which in practice means shipping the FIDO Metadata Service blob and refreshing it. Verifying a chain without anchors accepts any self-signed certificate an attacker cares to mint, so it reads as a check while proving nothing. Refusing is the honest default; if you need "only these authenticator models may enroll", that is a trust-anchor feature this package does not have yet.

None of this is what secures a passkey. A registration is trustworthy because the account was already authenticated when it enrolled, the challenge was fresh, the origin matched and the relying party id matched — all verified here on every ceremony.

The AAGUID is reported either way, so authenticator models can be recorded or displayed.

## Versioning

Releases are dated (`2026.9.4`) and carry no compatibility promise between them. Pin an exact version.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
