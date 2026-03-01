import { badRequest, ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import {
	generateAuthenticationOptions,
	type GenerateAuthenticationOptionsOpts,
} from "@simplewebauthn/server";
import * as s from "remix/data-schema";

import action from "~/lib/action";
import Passkey from "~/tenant/models/passkey";
import Subject from "~/tenant/models/subject";
import TenantMeta from "~/tenant/models/tenant-meta";
import WebAuthnChallenge from "~/tenant/models/webauthn-challenge";

let RequestSchema = s.object({
	email: s.string(),
	clientId: s.optional(s.string()),
	redirectUri: s.optional(s.string()),
	state: s.optional(s.string()),
	nonce: s.optional(s.string()),
	scope: s.optional(s.string()),
});

export default action<"POST", "/webauthn/auth/options">(async ({ db, formData, request }) => {
	let result = await validate(Object.fromEntries(formData), RequestSchema);
	if (isFailure(result)) {
		return badRequest({ error: "Invalid request", issues: result.error.issues });
	}

	let { email, clientId, redirectUri, state, nonce, scope } = result.data;

	// Find subject by email
	let subject = await Subject.findByEmail(db, email);
	if (!subject) {
		// Don't reveal whether user exists - return generic error
		return badRequest({ error: "No passkey found. Please register first." });
	}

	// Get user's passkeys
	let passkeys = await Passkey.listBySubject(db, subject.id);
	if (passkeys.length === 0) {
		return badRequest({ error: "No passkey found. Please register first." });
	}

	// Get tenant info for RP
	let issuer = await TenantMeta.getIssuer(db);
	let rpId = issuer ? new URL(`https://${issuer}`).hostname : new URL(request.url).hostname;

	// Create WebAuthn challenge
	let { id: challengeId, challenge } = await WebAuthnChallenge.createForAuthentication(db, {
		subjectId: subject.id,
		clientId,
		redirectUri,
		state,
		nonce,
		scope,
	});

	// Build allowCredentials from user's passkeys
	let allowCredentials = passkeys.map((passkey) => ({
		id: passkey.id,
		type: "public-key" as const,
		transports: passkey.transports
			? (passkey.transports.split(",") as AuthenticatorTransport[])
			: undefined,
	}));

	// Generate authentication options using @simplewebauthn/server
	let authenticationOptions = await generateAuthenticationOptions({
		rpID: rpId,
		allowCredentials,
		userVerification: "preferred",
		challenge: new TextEncoder().encode(challenge),
	} satisfies GenerateAuthenticationOptionsOpts);

	return ok({
		challengeId,
		options: authenticationOptions,
	});
});
