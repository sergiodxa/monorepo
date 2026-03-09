---
title: How to Implement WebAuthn Registration with @simplewebauthn/server
excerpt: Build a passkey registration flow with challenge generation, verification, and credential storage.
tech: "@simplewebauthn/server@11.0.0"
---

Passkey registration needs two server endpoints: one to issue a registration challenge and one to verify the authenticator response. The tricky part is tying both requests together without weakening the WebAuthn guarantees.

This tutorial builds that flow with `@simplewebauthn/server`. By the end, you will generate registration options, verify the attestation response, consume challenges once, and persist the new credential for later sign in.

## Create the Challenge Model

```ts {% path="app/models/webauthn-challenge.ts" %}
let CHALLENGE_TTL = 5 * 60 * 1000;

class WebAuthnChallenge {
	static ExpiredChallengeError = class extends Error {
		override name = "ExpiredChallengeError";
	};

	static InvalidChallengeError = class extends Error {
		override name = "InvalidChallengeError";
	};

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

	static async consume(db: Database, id: string) {
		let record = await db.findOne(WebAuthnChallenge.table, { where: { id } });
		if (!record) throw new WebAuthnChallenge.InvalidChallengeError();

		await db.delete(WebAuthnChallenge.table, { id });

		if (record.expires_at < Date.now()) {
			throw new WebAuthnChallenge.ExpiredChallengeError();
		}

		return record;
	}

	private static generateChallenge(): string {
		let bytes = crypto.getRandomValues(new Uint8Array(32));
		return base64UrlEncode(bytes);
	}
}
```

Start with a database backed challenge. It gives you a single use token that expires quickly, which is what the registration ceremony expects.

Deleting the record before the expiration check prevents replay. Even an expired challenge can only be attempted once.

## Generate the Registration Options

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
	let existingSubject = await Subject.findByEmail(db, email);

	if (existingSubject) {
		let existingPasskeys = await Passkey.listBySubject(db, existingSubject.id);
		if (existingPasskeys.length > 0) {
			return badRequest({
				error: "User already has a passkey. Please sign in instead.",
			});
		}
	}

	let subject: Subject;
	if (existingSubject) {
		subject = existingSubject;
	} else {
		let username = email.split("@")[0] ?? email;
		subject = await Subject.register(db, { email, username });
	}

	let { id: challengeId, challenge } = await WebAuthnChallenge.createForRegistration(db, { email });

	let rpId = new URL(request.url).hostname;
	let rpName = rpId;

	let options = await generateRegistrationOptions({
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

	return ok({ challengeId, options });
}
```

This route creates or reuses the subject, stores a challenge, and returns browser ready options. The `rpID` and `expectedOrigin` pair later tie the credential to your domain.

Using `attestationType: "none"` keeps the flow simpler. It skips manufacturer attestation data, which most apps do not need.

## Store the Credential Record

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

You need enough data to verify future assertions. The important fields are the credential ID, the public key, and the signature counter.

## Verify the Registration Response

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

	let rpId = new URL(request.url).hostname;
	let origin = new URL(request.url).origin;

	let verification;
	try {
		verification = await verifyRegistrationResponse({
			response,
			expectedChallenge: challenge.challenge,
			expectedOrigin: origin,
			expectedRPID: rpId,
			requireUserVerification: false,
		});
	} catch {
		return badRequest({ error: "Passkey verification failed" });
	}

	if (!verification.verified || !verification.registrationInfo) {
		return badRequest({ error: "Passkey verification failed" });
	}

	let subject = await Subject.findByEmail(db, challenge.email);
	if (!subject) {
		let username = challenge.email.split("@")[0] ?? challenge.email;
		subject = await Subject.register(db, { email: challenge.email, username });
	}

	let { registrationInfo } = verification;

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

This route consumes the challenge first, then verifies the attestation against the stored challenge, origin, and relying party ID. If verification succeeds, it stores the credential that the authentication flow will need later.

`requireUserVerification: false` accepts authenticators that only prove user presence. Change it to `true` if your product requires biometrics or device PIN verification.

## Call the Registration Flow

```ts {% path="app/lib/passkey.client.ts" %}
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";

async function registerPasskey(email: string) {
	if (!browserSupportsWebAuthn()) {
		throw new Error("WebAuthn is not supported in this browser");
	}

	let optionsResponse = await fetch("/webauthn/register/options", {
		method: "POST",
		body: new URLSearchParams({ email }),
	});

	let { challengeId, options } = await optionsResponse.json();
	let response = await startRegistration(options);

	let verifyResponse = await fetch("/webauthn/register/verify", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ challengeId, response }),
	});

	return verifyResponse.json();
}
```

The browser step is short. Ask the server for options, run `startRegistration`, then POST the result back for verification.

## Harden the Flow

```ts {% path="app/routes/webauthn.register-options.ts" %}
async function handleRegisterOptions(request: Request, db: Database) {
	// ... previous code

	let { email } = result.data;
	let rateLimit = checkUserRateLimit(email, "registerOptions", USER_RATE_LIMITS.registerOptions);

	if (!rateLimit.success) {
		return tooManyRequests({
			error: "Too many registration attempts. Please try again later.",
			retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
		});
	}

	// ... previous code
}
```

```ts {% path="app/routes/webauthn.register-verify.ts" %}
async function handleRegisterVerify(request: Request, db: Database) {
	// ... previous code

	if (!subject.email_verified_at) {
		await Subject.verifyEmail(db, subject.id);
	}

	// ... previous code
}
```

Rate limiting prevents unlimited challenge creation. Marking the email as verified after a successful registration works well when the passkey flow already starts from an emailed link or code.

## Final Thoughts

This registration flow stays small because `@simplewebauthn/server` handles the attestation checks while your app handles challenge storage and credential persistence. From here, the next step is the sign in flow, where you look up the stored credential, verify the assertion, and update the counter.

If you want the matching login side, see [How to Implement WebAuthn Authentication with @simplewebauthn/server](/tutorials/implement-webauthn-authentication-with-simplewebauthn-server).
