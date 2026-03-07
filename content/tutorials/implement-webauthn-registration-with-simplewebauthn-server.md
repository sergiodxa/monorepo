---
title: How to Implement WebAuthn Registration with @simplewebauthn/server
excerpt: Build passkey registration with challenge generation, verification, and credential storage.
tech: "@simplewebauthn/server@11.0.0"
---

Passkeys provide a more secure and user friendly alternative to passwords. They use public key cryptography where the private key never leaves the user's device, eliminating phishing attacks and credential stuffing. The WebAuthn API handles the browser side, but you need server side logic to generate registration options, verify the authenticator response, and store the credential.

The `@simplewebauthn/server` package simplifies WebAuthn implementation by handling the complex cryptographic verification. This tutorial walks through building a complete registration flow: generating registration options with proper relying party configuration, verifying the authenticator attestation, and storing credentials for future authentication.

## Understand the Registration Flow

WebAuthn registration involves two server round trips. First, the client requests registration options from your server. These options include a cryptographic challenge, relying party information, and user details. The browser uses these options to prompt the authenticator (fingerprint sensor, security key, or platform authenticator) to create a new credential.

Second, the client sends the authenticator's response back to your server. This response contains the public key, credential ID, and attestation data. Your server verifies this response against the original challenge and stores the credential for future authentication.

## Generate Registration Options

Start by creating an endpoint that generates registration options. This endpoint needs to validate the user's email, check for existing passkeys, and create a challenge.

```ts {% path="app/routes/webauthn.register-options.ts" %}
import {
	generateRegistrationOptions,
	type GenerateRegistrationOptionsOpts,
} from "@simplewebauthn/server";

let RequestSchema = object({
	email: string(),
});

async function handleRegisterOptions(request: Request, db: Database) {
	let formData = await request.formData();
	let result = await validate(Object.fromEntries(formData), RequestSchema);

	if (isFailure(result)) {
		return badRequest({ error: "Invalid request", issues: result.error.issues });
	}

	let { email } = result.data;

	// Check if user already has a passkey
	let existingSubject = await Subject.findByEmail(db, email);
	if (existingSubject) {
		let existingPasskeys = await Passkey.listBySubject(db, existingSubject.id);
		if (existingPasskeys.length > 0) {
			return badRequest({
				error: "User already has a passkey. Please sign in instead.",
			});
		}
	}

	// Create or retrieve the subject
	let subject: Subject;
	if (existingSubject) {
		subject = existingSubject;
	} else {
		let username = email.split("@")[0] ?? email;
		subject = await Subject.register(db, { email, username });
	}

	// Generate the challenge
	let { id: challengeId, challenge } = await WebAuthnChallenge.createForRegistration(db, { email });

	// Build registration options
	let rpId = new URL(request.url).hostname;
	let rpName = rpId;

	let registrationOptions = await generateRegistrationOptions({
		rpName,
		rpID: rpId,
		userName: email,
		userDisplayName: subject.display_name ?? email,
		userID: new TextEncoder().encode(subject.id),
		attestationType: "none",
		authenticatorSelection: {
			residentKey: "preferred",
			userVerification: "preferred",
		},
		challenge: base64UrlDecode(challenge),
	} satisfies GenerateRegistrationOptionsOpts);

	return ok({
		challengeId,
		options: registrationOptions,
	});
}
```

The `rpID` (relying party ID) is your domain name. This binds the credential to your domain, so credentials created on `auth.example.com` cannot be used on `attacker.com`. The `userName` should be unique per user, typically the email address. The `userDisplayName` is what the authenticator shows to the user.

The `attestationType: "none"` tells the authenticator not to include attestation certificates. Unless you need to verify the authenticator's manufacturer (for high security scenarios), skipping attestation simplifies verification and improves privacy.

## Store the Challenge

Challenges must be single use and time limited. Store them in your database with an expiration.

```ts {% path="app/models/webauthn-challenge.ts" %}
const CHALLENGE_TTL = 5 * 60 * 1000; // 5 minutes

class WebAuthnChallenge {
	static async createForRegistration(
		db: Database,
		data: {
			email: string;
			clientId?: string;
			redirectUri?: string;
			state?: string;
			nonce?: string;
			scope?: string;
		},
	) {
		let id = crypto.randomUUID();
		let challenge = WebAuthnChallenge.generateChallenge();
		let now = Date.now();

		await db.create(WebAuthnChallenge.table, {
			id,
			challenge,
			type: "registration",
			email: data.email,
			client_id: data.clientId ?? null,
			redirect_uri: data.redirectUri ?? null,
			state: data.state ?? null,
			nonce: data.nonce ?? null,
			scope: data.scope ?? null,
			expires_at: now + CHALLENGE_TTL,
			created_at: now,
		});

		return { id, challenge };
	}

	private static generateChallenge(): string {
		let bytes = crypto.getRandomValues(new Uint8Array(32));
		return base64UrlEncode(bytes);
	}
}
```

The challenge is 32 random bytes encoded as base64url. This provides enough entropy to prevent guessing attacks. Store OAuth parameters (clientId, redirectUri, state) with the challenge if you are integrating with an authorization flow.

## Verify the Registration Response

When the client sends back the authenticator's response, verify it against the stored challenge.

```ts {% path="app/routes/webauthn.register-verify.ts" %}
import { verifyRegistrationResponse } from "@simplewebauthn/server";

let RequestSchema = object({
	challengeId: string(),
	response: object({
		id: string(),
		rawId: string(),
		response: object({
			clientDataJSON: string(),
			attestationObject: string(),
			transports: optional(array(string())),
			publicKeyAlgorithm: optional(number()),
			publicKey: optional(string()),
			authenticatorData: optional(string()),
		}),
		authenticatorAttachment: optional(string()),
		clientExtensionResults: optional(record(string(), any())),
		type: literal("public-key"),
	}),
});

async function handleRegisterVerify(request: Request, db: Database) {
	let body = await request.json();
	let result = await validate(body, RequestSchema);

	if (isFailure(result)) {
		return badRequest({ error: "Invalid request", issues: result.error.issues });
	}

	let { challengeId, response } = result.data;

	// Consume the challenge (single use)
	let challenge;
	try {
		challenge = await WebAuthnChallenge.consume(db, challengeId);
	} catch (error) {
		if (error instanceof WebAuthnChallenge.InvalidChallengeError) {
			return badRequest({ error: "Invalid challenge" });
		}
		if (error instanceof WebAuthnChallenge.ExpiredChallengeError) {
			return badRequest({ error: "Challenge expired. Please try again." });
		}
		throw error;
	}

	if (challenge.type !== "registration") {
		return badRequest({ error: "Invalid challenge type" });
	}

	if (!challenge.email) {
		return badRequest({ error: "Invalid challenge: missing email" });
	}

	// Verify the registration response
	let rpId = new URL(request.url).hostname;
	let origin = new URL(request.url).origin;

	let verification;
	try {
		verification = await verifyRegistrationResponse({
			response: response,
			expectedChallenge: challenge.challenge,
			expectedOrigin: origin,
			expectedRPID: rpId,
			requireUserVerification: false,
		});
	} catch (error) {
		return badRequest({ error: "Passkey verification failed" });
	}

	if (!verification.verified || !verification.registrationInfo) {
		return badRequest({ error: "Passkey verification failed" });
	}

	// Store the credential
	let { registrationInfo } = verification;

	let subject = await Subject.findByEmail(db, challenge.email);
	if (!subject) {
		let username = challenge.email.split("@")[0] ?? challenge.email;
		subject = await Subject.register(db, { email: challenge.email, username });
	}

	await Passkey.create(db, {
		subjectId: subject.id,
		credentialId: registrationInfo.credentialID,
		publicKey: Buffer.from(registrationInfo.credentialPublicKey).toString("base64"),
		counter: registrationInfo.counter,
		deviceType: registrationInfo.credentialDeviceType,
		backedUp: registrationInfo.credentialBackedUp,
		transports: response.response.transports?.join(",") ?? null,
	});

	return ok({
		success: true,
		subjectId: subject.id,
		email: subject.email,
	});
}
```

The `verifyRegistrationResponse` function does the heavy lifting. It decodes the attestation object, verifies the signature, and extracts the credential public key. The `expectedChallenge` must match exactly what was stored. The `expectedOrigin` and `expectedRPID` prevent credentials from being used on different domains.

Setting `requireUserVerification: false` allows authenticators that only verify user presence (like a tap on a security key) without biometrics. Set this to `true` if you require biometric verification.

## Consume Challenges Safely

Challenges must be deleted immediately after verification to prevent replay attacks.

```ts {% path="app/models/webauthn-challenge.ts" %}
class WebAuthnChallenge {
	static ExpiredChallengeError = class extends Error {
		override name = "ExpiredChallengeError";
	};

	static InvalidChallengeError = class extends Error {
		override name = "InvalidChallengeError";
	};

	static async consume(db: Database, id: string) {
		let record = await db.findOne(WebAuthnChallenge.table, { where: { id } });
		if (!record) throw new WebAuthnChallenge.InvalidChallengeError();

		// Delete immediately (single use)
		await db.delete(WebAuthnChallenge.table, { id });

		// Check expiration after deletion
		if (record.expires_at < Date.now()) {
			throw new WebAuthnChallenge.ExpiredChallengeError();
		}

		return record;
	}
}
```

Delete the challenge before checking expiration. This ensures that even if the challenge is expired, it cannot be reused. An attacker who somehow gets a valid challenge ID cannot use it twice.

## Store Credentials

Store all the credential data you will need for authentication.

```ts {% path="app/models/passkey.ts" %}
class Passkey {
	static async create(
		db: Database,
		data: {
			subjectId: string;
			credentialId: string;
			publicKey: string;
			counter: number;
			deviceType?: string | null;
			backedUp?: boolean;
			transports?: string | null;
			name?: string | null;
		},
	) {
		return await db.create(Passkey.table, {
			id: crypto.randomUUID(),
			subject_id: data.subjectId,
			credential_id: data.credentialId,
			public_key: data.publicKey,
			counter: data.counter,
			device_type: data.deviceType ?? null,
			backed_up: data.backedUp ?? false,
			transports: data.transports ?? null,
			name: data.name ?? null,
			created_at: new Date().toISOString(),
			last_used_at: null,
		});
	}
}
```

The `credentialId` identifies this credential during authentication. The `publicKey` verifies signatures. The `counter` detects cloned authenticators: the counter increments with each use, and a lower counter indicates a clone. The `transports` array (USB, NFC, BLE, internal) helps the browser prompt the correct authenticator during authentication.

The `deviceType` indicates whether the credential is `singleDevice` (bound to one authenticator) or `multiDevice` (synced across devices like iCloud Keychain). The `backedUp` flag indicates whether a multi device credential has been synced.

## Add Rate Limiting

Protect your registration endpoint from abuse.

```ts {% path="app/routes/webauthn.register-options.ts" %}
async function handleRegisterOptions(request: Request, db: Database) {
	let { email } = result.data;

	let rateLimit = checkUserRateLimit(email, "registerOptions", USER_RATE_LIMITS.registerOptions);

	if (!rateLimit.success) {
		return tooManyRequests({
			error: "Too many registration attempts. Please try again later.",
			retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
		});
	}

	// ... rest of the handler
}
```

Rate limit by email address to prevent attackers from generating unlimited challenges. Include a `retryAfter` value so clients know when they can try again.

## Handle Email Verification

Passkey registration implicitly verifies email ownership. When a user registers a passkey, they prove control of their device. If you sent a magic link or code to start the registration flow, successful passkey creation confirms they received it.

```ts {% path="app/routes/webauthn.register-verify.ts" %}
if (!subject.email_verified_at) {
	await Subject.verifyEmail(db, subject.id);
}
```

This avoids requiring a separate email verification step, improving the user experience while maintaining security.

## Integrate with the Client

On the client, use `@simplewebauthn/browser` to handle the WebAuthn API.

```ts {% path="app/lib/passkey.client.ts" %}
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";

async function registerPasskey(email: string) {
	if (!browserSupportsWebAuthn()) {
		throw new Error("WebAuthn is not supported in this browser");
	}

	// Get registration options from server
	let optionsResponse = await fetch("/webauthn/register/options", {
		method: "POST",
		body: new URLSearchParams({ email }),
	});

	let { challengeId, options } = await optionsResponse.json();

	// Start the WebAuthn registration ceremony
	let attestationResponse = await startRegistration(options);

	// Send the response to the server for verification
	let verifyResponse = await fetch("/webauthn/register/verify", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			challengeId,
			response: attestationResponse,
		}),
	});

	return verifyResponse.json();
}
```

The `startRegistration` function handles the browser's credential creation, including prompting the user to touch their authenticator or use biometrics. It returns the attestation response that your server verifies.

## Final Thoughts

WebAuthn registration requires careful attention to security details: random challenges, single use verification, proper origin checking, and rate limiting. The `@simplewebauthn/server` package handles the cryptographic complexity, letting you focus on the application logic.

For the complete authentication flow including assertion verification and counter updates, see [How to Implement WebAuthn Authentication with @simplewebauthn/server](/tutorials/implement-webauthn-authentication-with-simplewebauthn-server). Consider adding passkey naming so users can identify which device created each credential, and implement cleanup for expired challenges using [Durable Object alarms](/tutorials/use-durable-object-alarms-for-background-cleanup).
