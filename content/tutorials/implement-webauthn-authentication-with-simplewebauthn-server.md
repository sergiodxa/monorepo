---
title: How to Implement WebAuthn Authentication with @simplewebauthn/server
excerpt: Build passkey sign-in with challenge generation, signature verification, and counter updates.
tech: "@simplewebauthn/server@11.0.0"
---

After [registering a passkey](/tutorials/implement-webauthn-registration-with-simplewebauthn-server), users need a way to sign in with it. The authentication flow involves generating a challenge, having the user prove they control the private key, and verifying that proof on your server.

The flow has two steps. First, your server generates authentication options including a challenge and the list of credentials the user can authenticate with. Second, after the browser calls the WebAuthn API and the user approves, your server verifies the cryptographic signature and updates the credential counter to prevent replay attacks.

## Generate Authentication Options

When a user wants to sign in with their passkey, they provide their email address. Your server looks up their registered passkeys and generates a challenge for them to sign.

```ts {% path="lib/webauthn/generate-auth-options.ts" %}
import {
	generateAuthenticationOptions,
	type GenerateAuthenticationOptionsOpts,
} from "@simplewebauthn/server";

interface Passkey {
	id: string;
	credential_id: string;
	public_key: string;
	counter: number;
	transports: string | null;
	subject_id: string;
}

async function createAuthenticationOptions(
	rpId: string,
	passkeys: Passkey[],
	challenge: Uint8Array,
) {
	let allowCredentials = passkeys.map((passkey) => ({
		id: passkey.credential_id,
		type: "public-key" as const,
		transports: passkey.transports
			? (passkey.transports.split(",") as AuthenticatorTransport[])
			: undefined,
	}));

	let options = await generateAuthenticationOptions({
		rpID: rpId,
		allowCredentials,
		userVerification: "preferred",
		challenge,
	} satisfies GenerateAuthenticationOptionsOpts);

	return options;
}
```

The `allowCredentials` array tells the browser which passkeys are valid for this user. Each entry includes the credential ID (which maps to a specific passkey) and the transports hint (like `usb`, `ble`, `nfc`, or `internal`) that helps the browser locate the authenticator. If you omit `allowCredentials`, the browser shows all available passkeys, which enables discoverable credentials where users can sign in without providing their email first.

The `userVerification` option controls whether the authenticator should verify the user through biometrics or a PIN. Setting it to `preferred` means verification happens if the device supports it, but authentication still succeeds on devices without that capability.

## Store the Challenge for Verification

Challenges must be single use and expire quickly to prevent replay attacks. Store the challenge with metadata about the authentication attempt.

```ts {% path="lib/webauthn/challenges.ts" %}
const CHALLENGE_TTL = 5 * 60 * 1000; // 5 minutes

interface ChallengeData {
	id: string;
	challenge: string;
	type: "authentication";
	subjectId: string;
	expiresAt: number;
}

async function createChallenge(
	db: Database,
	subjectId: string,
): Promise<{ id: string; challenge: string }> {
	let id = crypto.randomUUID();
	let bytes = crypto.getRandomValues(new Uint8Array(32));
	let challenge = base64UrlEncode(bytes);

	await db.create("challenges", {
		id,
		challenge,
		type: "authentication",
		subject_id: subjectId,
		expires_at: Date.now() + CHALLENGE_TTL,
	});

	return { id, challenge };
}
```

The challenge ID is returned to the client along with the authentication options. When the client sends back the signed response, it includes this ID so your server can look up the original challenge.

## Build the Authentication Options Endpoint

Putting it together, here is a complete endpoint that validates the request, checks for registered passkeys, generates a challenge, and returns the authentication options.

```ts {% path="app/routes/api/auth-options.ts" %}
import { badRequest, ok, tooManyRequests } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import {
	generateAuthenticationOptions,
	type GenerateAuthenticationOptionsOpts,
} from "@simplewebauthn/server";

let RequestSchema = z.object({
	email: z.string().email(),
});

export async function handleAuthOptions(request: Request, db: Database) {
	let body = await request.json();
	let result = await validate(body, RequestSchema);

	if (isFailure(result)) {
		return badRequest({ error: "Invalid request" });
	}

	let { email } = result.data;

	// Find the user by email
	let subject = await db.findOne("subjects", { where: { email } });
	if (!subject) {
		return badRequest({ error: "No passkey found. Please register first." });
	}

	// Get all passkeys for this user
	let passkeys = await db.findMany("passkeys", {
		where: { subject_id: subject.id },
	});

	if (passkeys.length === 0) {
		return badRequest({ error: "No passkey found. Please register first." });
	}

	// Determine the relying party ID from your domain
	let rpId = new URL(request.url).hostname;

	// Create a challenge and store it
	let { id: challengeId, challenge } = await createChallenge(db, subject.id);

	// Build the allowCredentials list
	let allowCredentials = passkeys.map((passkey) => ({
		id: passkey.credential_id,
		type: "public-key" as const,
		transports: passkey.transports
			? (passkey.transports.split(",") as AuthenticatorTransport[])
			: undefined,
	}));

	// Generate authentication options
	let options = await generateAuthenticationOptions({
		rpID: rpId,
		allowCredentials,
		userVerification: "preferred",
		challenge: base64UrlDecode(challenge),
	} satisfies GenerateAuthenticationOptionsOpts);

	return ok({
		challengeId,
		options,
	});
}
```

The endpoint returns both the `challengeId` and the `options` object. The client passes the options to the browser's WebAuthn API and sends back the response along with the challenge ID.

## Verify the Authentication Response

After the user approves the authentication on their device, the browser returns a signed assertion. Your server must verify this signature against the stored public key.

```ts {% path="lib/webauthn/verify-auth.ts" %}
import { verifyAuthenticationResponse } from "@simplewebauthn/server";

interface AuthenticationResponse {
	id: string;
	rawId: string;
	response: {
		clientDataJSON: string;
		authenticatorData: string;
		signature: string;
		userHandle?: string;
	};
	authenticatorAttachment?: string;
	clientExtensionResults?: Record<string, unknown>;
	type: "public-key";
}

async function verifyAuthentication(
	response: AuthenticationResponse,
	challenge: string,
	origin: string,
	rpId: string,
	passkey: Passkey,
) {
	// Convert the stored public key from base64 to Uint8Array
	let publicKeyBytes = Uint8Array.from(atob(passkey.public_key), (c) => c.charCodeAt(0));

	let verification = await verifyAuthenticationResponse({
		response,
		expectedChallenge: challenge,
		expectedOrigin: origin,
		expectedRPID: rpId,
		authenticator: {
			credentialID: passkey.credential_id,
			credentialPublicKey: publicKeyBytes,
			counter: passkey.counter,
			transports: passkey.transports
				? (passkey.transports.split(",") as AuthenticatorTransport[])
				: undefined,
		},
		requireUserVerification: false,
	});

	return verification;
}
```

The `verifyAuthenticationResponse` function checks several things: it verifies the signature was created by the private key matching your stored public key, confirms the challenge matches what you generated, validates the origin and relying party ID to prevent phishing attacks, and checks that the counter is higher than the stored value to detect cloned authenticators.

Setting `requireUserVerification` to `false` means you accept authentications where the device did not verify the user (for example, a security key without biometrics). Set this to `true` if your security requirements demand biometric or PIN verification on every sign in.

## Update the Signature Counter

Every WebAuthn authentication increments a counter on the authenticator. Your server must store this new counter value and reject authentications where the counter did not increase. This detects cloned authenticators.

```ts {% path="lib/webauthn/update-counter.ts" %}
async function updatePasskeyCounter(db: Database, passkeyId: string, newCounter: number) {
	await db.update(
		"passkeys",
		{ id: passkeyId },
		{
			counter: newCounter,
			last_used_at: new Date().toISOString(),
		},
	);
}
```

Updating `last_used_at` is optional but useful for showing users when each passkey was last used, helping them identify unused credentials they might want to remove.

## Build the Verification Endpoint

Here is the full verification endpoint that consumes the challenge, looks up the passkey, verifies the signature, and updates the counter.

```ts {% path="app/routes/api/auth-verify.ts" %}
import { badRequest, ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";

let VerifySchema = z.object({
	challengeId: z.string(),
	response: z.object({
		id: z.string(),
		rawId: z.string(),
		response: z.object({
			clientDataJSON: z.string(),
			authenticatorData: z.string(),
			signature: z.string(),
			userHandle: z.string().optional(),
		}),
		authenticatorAttachment: z.string().optional(),
		clientExtensionResults: z.record(z.string(), z.any()).optional(),
		type: z.literal("public-key"),
	}),
});

export async function handleAuthVerify(request: Request, db: Database) {
	let body = await request.json();
	let result = await validate(body, VerifySchema);

	if (isFailure(result)) {
		return badRequest({ error: "Invalid request" });
	}

	let { challengeId, response } = result.data;

	// Consume the challenge (deletes it so it cannot be reused)
	let challenge;
	try {
		challenge = await consumeChallenge(db, challengeId);
	} catch (error) {
		if (error instanceof InvalidChallengeError) {
			return badRequest({ error: "Invalid challenge" });
		}
		if (error instanceof ExpiredChallengeError) {
			return badRequest({ error: "Challenge expired. Please try again." });
		}
		throw error;
	}

	if (challenge.type !== "authentication") {
		return badRequest({ error: "Invalid challenge type" });
	}

	// Look up the subject
	let subject = await db.findOne("subjects", {
		where: { id: challenge.subject_id },
	});

	if (!subject) {
		return badRequest({ error: "User not found" });
	}

	// Find the passkey by credential ID
	let passkey = await db.findOne("passkeys", {
		where: { credential_id: response.id },
	});

	if (!passkey || passkey.subject_id !== subject.id) {
		return badRequest({ error: "Passkey not found" });
	}

	// Prepare verification parameters
	let rpId = new URL(request.url).hostname;
	let origin = new URL(request.url).origin;
	let publicKeyBytes = Uint8Array.from(atob(passkey.public_key), (c) => c.charCodeAt(0));

	// Verify the authentication response
	let verification;
	try {
		verification = await verifyAuthenticationResponse({
			response,
			expectedChallenge: challenge.challenge,
			expectedOrigin: origin,
			expectedRPID: rpId,
			authenticator: {
				credentialID: passkey.credential_id,
				credentialPublicKey: publicKeyBytes,
				counter: passkey.counter,
				transports: passkey.transports
					? (passkey.transports.split(",") as AuthenticatorTransport[])
					: undefined,
			},
			requireUserVerification: false,
		});
	} catch (error) {
		return badRequest({ error: "Authentication failed" });
	}

	if (!verification.verified || !verification.authenticationInfo) {
		return badRequest({ error: "Authentication failed" });
	}

	// Update the counter to prevent replay attacks
	await updatePasskeyCounter(db, passkey.id, verification.authenticationInfo.newCounter);

	// Create a session or return success
	return ok({
		success: true,
		subjectId: subject.id,
		email: subject.email,
	});
}
```

The flow is straightforward: consume the challenge first to prevent replay attacks, look up the passkey by the credential ID from the response, verify the cryptographic signature, update the counter, then create a session or return whatever authentication token your application uses.

## Handle OAuth Flows

If you are building an OAuth provider, the authentication challenge can carry OAuth parameters. After successful authentication, generate an authorization code and redirect the user.

```ts {% path="lib/webauthn/oauth-redirect.ts" %}
if (challenge.client_id && challenge.redirect_uri) {
	// Create a session for the user
	let sessionId = await createSession(db, {
		subjectId: subject.id,
		clientId: challenge.client_id,
	});

	// Generate an authorization code
	let code = await createAuthorizationCode(db, {
		clientId: challenge.client_id,
		subjectId: subject.id,
		sessionId,
		redirectUri: challenge.redirect_uri,
		scope: challenge.scope?.split(" "),
		nonce: challenge.nonce,
	});

	// Build the redirect URL
	let redirectUrl = new URL(challenge.redirect_uri);
	redirectUrl.searchParams.set("code", code);
	if (challenge.state) {
		redirectUrl.searchParams.set("state", challenge.state);
	}

	return ok({
		success: true,
		redirect: redirectUrl.toString(),
	});
}
```

This pattern lets you use WebAuthn authentication within standard OAuth/OIDC flows, giving users passwordless login while maintaining compatibility with existing OAuth clients.

## Add Security Protections

Rate limiting is essential for authentication endpoints. Without it, attackers can brute force user enumeration or exhaust server resources. Apply rate limits per email address on the options endpoint and per user on the verification endpoint.

Challenge expiration prevents old challenges from being used in delayed attacks. Five minutes is a reasonable default, giving users enough time to complete authentication while limiting the attack window.

The signature counter is your defense against cloned authenticators. If someone physically copies a security key, both copies share the same counter. When the clone authenticates, the counter jumps ahead. The next time the original key tries to authenticate, the server sees the counter is lower than expected and rejects it. Always store and verify the counter.

Origin validation prevents phishing. Even if an attacker tricks a user into authenticating on a fake site, the authenticator binds the signature to the real origin. Your server rejects responses signed for different origins.

## Final Thoughts

WebAuthn authentication is more secure than passwords because the private key never leaves the user's device. The `@simplewebauthn/server` library handles the complex cryptographic verification, letting you focus on the business logic around challenges, passkey lookup, and session management.

For the registration side of this flow, see [How to Implement WebAuthn Registration with @simplewebauthn/server](/tutorials/implement-webauthn-registration-with-simplewebauthn-server). Together, these two tutorials give you a complete passwordless authentication system.
