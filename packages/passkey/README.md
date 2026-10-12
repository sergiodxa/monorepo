# @sdxc/passkey

Passkeys end to end: a WebAuthn browser API and a verifying relying party.

`@sdxc/passkey/client` runs a ceremony in the browser with one call and hands back JSON to post.
`@sdxc/passkey/server` issues the options and challenge for each ceremony and verifies what comes
back using only WebCrypto, so it runs on Workers, Node and Deno. `RegistrationResponseJSON`,
`AuthenticationResponseJSON` and the options types are the DOM WebAuthn types.

## Installation

```sh
npm add @sdxc/passkey
```

Every call answers a `Result`; install [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result)
to import `isFailure` and `isSuccess`.

## Usage

### Create a relying party

The relying party is the site passkeys are bound to. It is stateless, so one instance at module
scope serves every request.

```typescript
import { RelyingParty } from "@sdxc/passkey/server";

export const RELYING_PARTY = new RelyingParty({ id: "example.com", name: "Example" });
```

### Register a passkey

Registration enrolls a passkey for an account that is already signed in. The server issues a
challenge and options: keep the challenge until the browser answers, and send the options.

```typescript
let { challenge, options } = RELYING_PARTY.register({
	user: { id: account.id, name: account.email },
	exclude: account.passkeys.map((passkey) => passkey.id),
});

session.set("passkeyChallenge", challenge);
return Response.json(options);
```

`user.id` is stored on the authenticator and comes back on every sign-in, so use an opaque
account id; `name` is what the browser lists the credential under. `exclude` makes the browser
refuse to enroll a device the account already has.

The browser runs the ceremony and posts the response back as JSON:

```typescript
import { Passkey } from "@sdxc/passkey/client";
import { isFailure } from "@sdxc/result";

let result = await Passkey.register(options);
if (isFailure(result)) return showMessage(result.error.message);

await fetch("/passkeys", {
	method: "POST",
	headers: { "content-type": "application/json" },
	body: JSON.stringify(result.data),
});
```

The server verifies it against the challenge and stores the credential it returns:

```typescript
import { isFailure } from "@sdxc/result";

let challenge = session.get("passkeyChallenge");
session.unset("passkeyChallenge");

let result = await RELYING_PARTY.verifyRegistration(request, { challenge });
if (isFailure(result)) return new Response(null, { status: 400 });

await db.passkeys.insert({ accountId: account.id, ...result.data });
```

### Sign in with a passkey

Leave `allow` out and the browser offers every passkey it holds for the site, so nobody types an
identifier first.

```typescript
let { challenge, options } = RELYING_PARTY.authenticate();
```

```typescript
let result = await Passkey.authenticate(options);
```

Find the stored credential by the id the response carries, verify against it, and record the new
signature counter:

```typescript
let response = (await request.json()) as AuthenticationResponseJSON;
let passkey = await db.passkeys.find(response.id);

let result = await RELYING_PARTY.verifyAuthentication(response, { challenge, passkey });
if (isFailure(result)) return new Response(null, { status: 401 });

await db.passkeys.update(passkey.id, { counter: result.data.counter });
let accountId = passkey.accountId;
```

### Offer passkeys in the sign-in field

`autofill` places the passkeys in an input's autocomplete menu instead of opening a sheet. Start it
as the page loads; it resolves once somebody picks a credential.

```html
<input type="text" name="email" autocomplete="username webauthn" />
```

```typescript
import { Passkey } from "@sdxc/passkey/client";
import { isSuccess } from "@sdxc/result";

if (await Passkey.isAutofillSupported()) {
	let result = await Passkey.autofill(options);
	if (isSuccess(result)) await submitAssertion(result.data);
}
```

## API

### `@sdxc/passkey/client`

#### `Passkey.register(options, ceremony?): Promise<Result<RegistrationResponseJSON, PasskeyError>>`

Runs `navigator.credentials.create()` with the options `rp.register()` issued and answers the
response as JSON to post.

#### `Passkey.authenticate(options, ceremony?): Promise<Result<AuthenticationResponseJSON, PasskeyError>>`

Runs `navigator.credentials.get()` and prompts immediately.

#### `Passkey.autofill(options, ceremony?): Promise<Result<AuthenticationResponseJSON, PasskeyError>>`

The same ceremony under conditional mediation: it stays pending until somebody picks a credential
from an input marked `autocomplete="username webauthn"`.

A browser keeps one ceremony open at a time, so each of the three calls cancels the ceremony
already open. `ceremony.signal` takes an `AbortSignal` that cancels this one as well.

#### `Passkey.cancel(): void`

Cancels the open ceremony, which releases a pending `autofill` when the person leaves the sign-in
step.

#### `Passkey.isSupported(): boolean`

Whether this page can run a ceremony: false on an insecure origin and on a browser without
WebAuthn.

#### `Passkey.isAutofillSupported(): Promise<boolean>`

Whether the browser can offer passkeys in an autofill menu.

#### `Passkey.isPlatformSupported(): Promise<boolean>`

Whether the device holds passkeys itself, behind a biometric or PIN.

### `@sdxc/passkey/server`

#### `new RelyingParty(options: RelyingParty.Options)`

- `id`: the registrable domain credentials are bound to, such as `"example.com"`; a parent domain
  covers its subdomains.
- `name`: shown in the passkey prompt.
- `origin`: origin or origins allowed to run ceremonies. Defaults to `https://<id>`.
- `userVerification`: `"required"` makes a missing biometric or PIN a failure. Defaults to
  `"preferred"`.
- `algorithms`: COSE algorithms offered, in preference order. Defaults to `[ES256, RS256, EDDSA]`.
- `timeout`: milliseconds the browser keeps the prompt open. Defaults to `300000`.
- `allowFramed`: whether a ceremony may run inside a cross-origin frame. Defaults to `false`.

#### `rp.register(options: RelyingParty.RegisterOptions): RelyingParty.Ceremony<PublicKeyCredentialCreationOptionsJSON>`

Issues a fresh challenge and the options for `Passkey.register`. Takes `user` (`{ id, name,
displayName? }`) and optionally `exclude`, `residentKey` (default `"preferred"`), `attachment` and
`userVerification`. Throws `RangeError` when `user.id` encodes to more than 64 bytes.

#### `rp.verifyRegistration(response, { challenge, userVerification? }): Promise<Result<RegisteredPasskey, PasskeyError>>`

Verifies a registration response, or a `Request` whose `application/json` body carries one, and
answers the credential to store. A `none` or self-signed `packed` attestation is verified; a
statement carrying a certificate chain is refused with `AttestationError`.

#### `rp.authenticate(options?: RelyingParty.AuthenticateOptions): RelyingParty.Ceremony<PublicKeyCredentialRequestOptionsJSON>`

Issues a fresh challenge and the options for `Passkey.authenticate` or `Passkey.autofill`. Takes
`allow` and `userVerification`; without `allow` the ceremony is usernameless.

#### `rp.verifyAuthentication(response, { challenge, passkey, userVerification? }): Promise<Result<AuthenticatedPasskey, PasskeyError>>`

Verifies an assertion, or a `Request` carrying one, against the stored `passkey`. Store the
`counter` it answers: a non-zero counter that fails to advance past the stored one fails with
`CounterError`.

#### `ES256`, `RS256`, `EDDSA`

COSE algorithm identifiers (`-7`, `-257`, `-8`) for the `algorithms` option.

### Errors

Every failure is a `PasskeyError`, exported from both entry points; a subclass names the step that
refused.

- Client: `UnsupportedError`, `CancelledError` (the person dismissed the prompt),
  `AlreadyRegisteredError` (the device is in `exclude`), `InvalidOptionsError`, `CeremonyError`.
- Server: `MalformedResponseError`, `ChallengeMismatchError`, `OriginMismatchError`,
  `CrossOriginError`, `RelyingPartyMismatchError`, `AttestationError`, `UserPresenceError`,
  `UserVerificationError`, `CredentialMismatchError`, `CounterError`, `UnsupportedAlgorithmError`.

### Types

#### `RelyingParty.Descriptor`

A known credential, as its id or as `{ id, transports }`. Passing stored transports lets the
browser go straight to the right authenticator.

#### `RelyingParty.Ceremony<T>`

`{ challenge, options }`: the challenge to keep until verification and the options to send.

#### `RegisteredPasskey`

The row to store: `id`, `publicKey`, `algorithm`, `counter`, `transports`, `aaguid` (the
authenticator model), `attestation`, `userVerified`, `syncable` and `backedUp`.

#### `StoredPasskey`

What `verifyAuthentication` reads from that row: `{ id, publicKey, counter }`.

#### `AuthenticatedPasskey`

`id`, the `counter` to store, `userHandle` (the `user.id` given at registration, for a discoverable
credential), `userVerified` and `backedUp`.

#### `Passkey.CeremonyOptions`

`{ signal?: AbortSignal }`.

## Pattern: Two JSON Endpoints Per Ceremony

A ceremony spans two requests, so the challenge has to outlive the first one. Spend it on read, so
one challenge buys exactly one verification.

```typescript
import { RelyingParty } from "@sdxc/passkey/server";
import { isFailure } from "@sdxc/result";

const RELYING_PARTY = new RelyingParty({
	id: "example.com",
	name: "Example",
	origin: ["https://example.com", "https://www.example.com"],
});

export async function issueChallenge(session: Session): Promise<Response> {
	let { challenge, options } = RELYING_PARTY.authenticate();
	session.set("passkeyChallenge", challenge);
	return Response.json(options);
}

export async function verifyAssertion(request: Request, session: Session): Promise<Response> {
	let challenge = session.get("passkeyChallenge");
	session.unset("passkeyChallenge");
	if (typeof challenge !== "string") return Response.json({ error: "rejected" }, { status: 400 });

	let response = (await request.json()) as AuthenticationResponseJSON;
	let passkey = await db.passkeys.find(response.id);
	if (!passkey) return Response.json({ error: "rejected" }, { status: 400 });

	let result = await RELYING_PARTY.verifyAuthentication(response, { challenge, passkey });
	if (isFailure(result)) {
		logger.warn("passkey rejected", { reason: result.error.name });
		return Response.json({ error: "rejected" }, { status: 400 });
	}

	await db.passkeys.update(passkey.id, { counter: result.data.counter });
	await signIn(session, passkey.accountId);
	return Response.json({ redirect: "/dashboard" });
}
```

Every refusal answers the same response and logs the error's `name`, so a caller learns nothing
about which check failed.

## Pattern: Autofill With A Button Fallback

The page starts an autofill ceremony on load and keeps a button for browsers that skip the menu.
Clicking the button cancels the pending autofill, and leaving the page releases it.

```typescript
import { CancelledError, Passkey } from "@sdxc/passkey/client";
import { isFailure } from "@sdxc/result";

async function signIn(autofill: boolean): Promise<void> {
	let options = await fetch("/passkey/challenge", { method: "POST" }).then((r) => r.json());

	let result = autofill ? await Passkey.autofill(options) : await Passkey.authenticate(options);
	if (isFailure(result)) {
		if (result.error instanceof CancelledError) return;
		return showMessage(result.error.message);
	}

	let verified = await fetch("/passkey/verify", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(result.data),
	});
	if (!verified.ok) return showMessage("That passkey was not accepted.");

	let { redirect } = (await verified.json()) as { redirect: string };
	location.assign(redirect);
}

if (Passkey.isSupported()) {
	button.hidden = false;
	button.addEventListener("click", () => void signIn(false));
	if (await Passkey.isAutofillSupported()) void signIn(true);
}

window.addEventListener("pagehide", () => Passkey.cancel());
```

## Pattern: Passkeys As A Second Factor

After a password, ask for one of the account's own passkeys and require the biometric or PIN on
both sides of the ceremony.

```typescript
import { RelyingParty } from "@sdxc/passkey/server";
import { isFailure } from "@sdxc/result";

let rp = new RelyingParty({ id: "example.com", name: "Example" });

let { challenge, options } = rp.authenticate({
	allow: account.passkeys.map((passkey) => ({ id: passkey.id, transports: passkey.transports })),
	userVerification: "required",
});

let result = await rp.verifyAuthentication(request, {
	challenge,
	passkey,
	userVerification: "required",
});
if (isFailure(result)) return new Response(null, { status: 401 });
```

## Pattern: Enrolling This Device

Restrict registration to a discoverable credential on the device itself, and offer it only where
the device can hold one.

```typescript
import { Passkey } from "@sdxc/passkey/client";

let offerEnrollment = await Passkey.isPlatformSupported();
```

```typescript
import { EDDSA, ES256, RelyingParty } from "@sdxc/passkey/server";

let rp = new RelyingParty({
	id: "example.com",
	name: "Example",
	algorithms: [ES256, EDDSA],
	userVerification: "required",
});

let { challenge, options } = rp.register({
	user: { id: account.id, name: account.email, displayName: account.fullName },
	exclude: account.passkeys.map((passkey) => ({ id: passkey.id, transports: passkey.transports })),
	residentKey: "required",
	attachment: "platform",
});
```

`syncable` and `backedUp` on the registered passkey tell whether it survives losing the device,
which is worth showing beside it in the account's passkey list.

## Pattern: Telling The Person What Happened

The client errors map to the answers a form actually gives.

```typescript
import {
	AlreadyRegisteredError,
	CancelledError,
	Passkey,
	UnsupportedError,
} from "@sdxc/passkey/client";
import { isFailure } from "@sdxc/result";

let result = await Passkey.register(options);

if (isFailure(result)) {
	if (result.error instanceof CancelledError) return;
	if (result.error instanceof AlreadyRegisteredError) return goToSignIn();
	if (result.error instanceof UnsupportedError) return offerAnotherMethod();
	return showMessage(result.error.message);
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
		"@sdxc/passkey": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
