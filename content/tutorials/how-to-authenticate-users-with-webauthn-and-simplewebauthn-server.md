---
title: How to Authenticate Users with WebAuthn and @simplewebauthn/server
excerpt: Build passkey sign in with challenge storage, assertion verification, and counter updates.
tech: "@simplewebauthn/server@11.0.0"
---

After a user registers a passkey, you still need the sign in flow. That means generating authentication options, storing a one time challenge, verifying the signed assertion, and updating the authenticator counter.

This tutorial builds that server flow step by step with `@simplewebauthn/server`. The final result is a pair of endpoints you can use to start authentication and finish it safely.

## Create the Authentication Options Helper

```ts {% path="lib/webauthn/generate-authentication-options.ts" %}
import {
	generateAuthenticationOptions,
	type AuthenticatorTransport,
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

export async function createAuthenticationOptions(
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

	return await generateAuthenticationOptions({
		rpID: rpId,
		allowCredentials,
		userVerification: "preferred",
		challenge,
	} satisfies GenerateAuthenticationOptionsOpts);
}
```

This helper turns your stored passkeys into the `allowCredentials` list the browser needs. The `challenge` stays server generated, and `userVerification: "preferred"` allows biometrics or PIN when the authenticator supports it.

## Store Authentication Challenges

```ts {% path="lib/webauthn/challenges.ts" %}
let CHALLENGE_TTL = 5 * 60 * 1000;

interface Database {
	create(table: string, values: Record<string, unknown>): Promise<void>;
}

interface ChallengeRecord {
	id: string;
	challenge: string;
	type: "authentication";
	subject_id: string;
	expires_at: number;
}

declare function base64UrlEncode(value: Uint8Array): string;

export async function createAuthenticationChallenge(db: Database, subjectId: string) {
	let id = crypto.randomUUID();
	let bytes = crypto.getRandomValues(new Uint8Array(32));
	let challenge = base64UrlEncode(bytes);
	let record: ChallengeRecord = {
		id,
		challenge,
		type: "authentication",
		subject_id: subjectId,
		expires_at: Date.now() + CHALLENGE_TTL,
	};

	await db.create("challenges", record);

	return {
		id,
		challenge,
		bytes,
	};
}
```

Challenges must be single use and short lived. Returning both the encoded value and raw bytes keeps the endpoint simple because the database stores the string while SimpleWebAuthn receives bytes.

## Add the Options Endpoint

```ts {% path="app/routes/api/auth-options.ts" %}
import { badRequest, ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { z } from "zod";
import { createAuthenticationOptions } from "~/lib/webauthn/generate-authentication-options";
import { createAuthenticationChallenge } from "~/lib/webauthn/challenges";

interface Database {
	findOne(table: string, options: { where: Record<string, unknown> }): Promise<any>;
	findMany(table: string, options: { where: Record<string, unknown> }): Promise<any[]>;
}

let RequestSchema = z.object({
	email: z.string().email(),
});

export async function handleAuthOptions(request: Request, db: Database) {
	let body = await request.json();
	let result = await validate(body, RequestSchema);

	if (isFailure(result)) {
		return badRequest({ error: "Invalid request" });
	}

	let subject = await db.findOne("subjects", {
		where: { email: result.data.email },
	});

	if (!subject) {
		return badRequest({ error: "No passkey found. Please register first." });
	}

	let passkeys = await db.findMany("passkeys", {
		where: { subject_id: subject.id },
	});

	if (passkeys.length === 0) {
		return badRequest({ error: "No passkey found. Please register first." });
	}

	let rpId = new URL(request.url).hostname;
	let challenge = await createAuthenticationChallenge(db, subject.id);
	let options = await createAuthenticationOptions(rpId, passkeys, challenge.bytes);

	return ok({
		challengeId: challenge.id,
		options,
	});
}
```

This endpoint validates the email, finds the user's passkeys, stores a challenge, and returns the options object for `navigator.credentials.get()`. The client only needs `challengeId` and `options` to start the authentication ceremony.

## Verify the Authentication Response

```ts {% path="lib/webauthn/verify-authentication-response.ts" %}
import { verifyAuthenticationResponse, type AuthenticatorTransport } from "@simplewebauthn/server";

interface Passkey {
	id: string;
	credential_id: string;
	public_key: string;
	counter: number;
	transports: string | null;
	subject_id: string;
}

interface AuthenticationResponse {
	id: string;
	rawId: string;
	response: {
		clientDataJSON: string;
		authenticatorData: string;
		signature: string;
		userHandle?: string;
	};
	type: "public-key";
	clientExtensionResults?: Record<string, unknown>;
	authenticatorAttachment?: string;
}

declare function base64UrlDecode(value: string): Uint8Array;

export async function verifyPasskeyAuthentication(
	response: AuthenticationResponse,
	challenge: string,
	origin: string,
	rpId: string,
	passkey: Passkey,
) {
	return await verifyAuthenticationResponse({
		response,
		expectedChallenge: challenge,
		expectedOrigin: origin,
		expectedRPID: rpId,
		authenticator: {
			credentialID: passkey.credential_id,
			credentialPublicKey: base64UrlDecode(passkey.public_key),
			counter: passkey.counter,
			transports: passkey.transports
				? (passkey.transports.split(",") as AuthenticatorTransport[])
				: undefined,
		},
		requireUserVerification: false,
	});
}
```

This is the core server check. It validates the challenge, origin, relying party ID, signature, and counter using the stored public key.

## Update the Stored Counter

```ts {% path="lib/webauthn/update-passkey-counter.ts" %}
interface Database {
	update(
		table: string,
		where: Record<string, unknown>,
		values: Record<string, unknown>,
	): Promise<void>;
}

export async function updatePasskeyCounter(db: Database, passkeyId: string, newCounter: number) {
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

WebAuthn authenticators increment this counter after each successful assertion. Storing the new value lets you detect replayed or cloned credentials on later requests.

## Add the Verification Endpoint

```ts {% path="app/routes/api/auth-verify.ts" %}
import { badRequest, ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { z } from "zod";
import { updatePasskeyCounter } from "~/lib/webauthn/update-passkey-counter";
import { verifyPasskeyAuthentication } from "~/lib/webauthn/verify-authentication-response";

interface Database {
	findOne(table: string, options: { where: Record<string, unknown> }): Promise<any>;
	delete(table: string, options: { where: Record<string, unknown> }): Promise<void>;
}

interface ChallengeRecord {
	id: string;
	challenge: string;
	type: "authentication";
	subject_id: string;
	expires_at: number;
}

declare function consumeChallenge(db: Database, challengeId: string): Promise<ChallengeRecord>;

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
		type: z.literal("public-key"),
		clientExtensionResults: z.record(z.string(), z.unknown()).optional(),
		authenticatorAttachment: z.string().optional(),
	}),
});

export async function handleAuthVerify(request: Request, db: Database) {
	let body = await request.json();
	let result = await validate(body, VerifySchema);

	if (isFailure(result)) {
		return badRequest({ error: "Invalid request" });
	}

	let challenge = await consumeChallenge(db, result.data.challengeId);

	if (challenge.type !== "authentication") {
		return badRequest({ error: "Invalid challenge" });
	}

	let subject = await db.findOne("subjects", {
		where: { id: challenge.subject_id },
	});

	if (!subject) {
		return badRequest({ error: "User not found" });
	}

	let passkey = await db.findOne("passkeys", {
		where: { credential_id: result.data.response.id },
	});

	if (!passkey || passkey.subject_id !== subject.id) {
		return badRequest({ error: "Passkey not found" });
	}

	let url = new URL(request.url);
	let verification = await verifyPasskeyAuthentication(
		result.data.response,
		challenge.challenge,
		url.origin,
		url.hostname,
		passkey,
	);

	if (!verification.verified || !verification.authenticationInfo) {
		return badRequest({ error: "Authentication failed" });
	}

	await updatePasskeyCounter(db, passkey.id, verification.authenticationInfo.newCounter);

	return ok({
		success: true,
		subjectId: subject.id,
		email: subject.email,
	});
}
```

This endpoint consumes the challenge before verification, loads the passkey by credential ID, verifies the assertion, and stores the new counter. After this point you can create a session, issue a token, or continue your own sign in flow.

## Finish the Sign In on Success

```ts {% path="app/routes/api/auth-verify.ts" %}
// ... previous code

import { createSession } from "~/lib/auth/sessions";

export async function handleAuthVerify(request: Request, db: Database) {
	// ... previous code

	let session = await createSession(db, { subjectId: subject.id });

	return ok({
		success: true,
		sessionId: session.id,
		subjectId: subject.id,
		email: subject.email,
	});
}
```

The WebAuthn check only proves possession of the passkey. Your application still needs to turn that success into a normal authenticated session.

## Final Thoughts

This flow gives you a practical WebAuthn sign in implementation with `@simplewebauthn/server`. If you also need registration, pair it with [How to Implement WebAuthn Registration with @simplewebauthn/server](/tutorials/implement-webauthn-registration-with-simplewebauthn-server) so users can enroll and authenticate with the same passkey system.
