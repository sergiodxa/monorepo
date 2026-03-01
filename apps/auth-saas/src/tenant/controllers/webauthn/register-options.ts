import { badRequest, ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import {
	generateRegistrationOptions,
	type GenerateRegistrationOptionsOpts,
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

export default action<"POST", "/webauthn/register/options">(async ({ db, formData, request }) => {
	let result = await validate(Object.fromEntries(formData), RequestSchema);
	if (isFailure(result)) {
		return badRequest({ error: "Invalid request", issues: result.error.issues });
	}

	let { email, clientId, redirectUri, state, nonce, scope } = result.data;

	// Check if subject already exists with passkeys
	let existingSubject = await Subject.findByEmail(db, email);
	if (existingSubject) {
		let existingPasskeys = await Passkey.listBySubject(db, existingSubject.id);
		if (existingPasskeys.length > 0) {
			return badRequest({ error: "User already has a passkey. Please sign in instead." });
		}
	}

	// Create or get subject
	let subject: Awaited<ReturnType<typeof Subject.findByEmail>>;
	if (existingSubject) {
		subject = existingSubject;
	} else {
		// Create new unverified subject
		let username = email.split("@")[0] ?? email;
		subject = await Subject.register(db, { email, username });
	}

	// Get tenant info for RP
	let issuer = await TenantMeta.getIssuer(db);
	let rpId = issuer ? new URL(`https://${issuer}`).hostname : new URL(request.url).hostname;
	let rpName = rpId; // Could be fetched from brand settings

	// Create WebAuthn challenge
	let { id: challengeId, challenge } = await WebAuthnChallenge.createForRegistration(db, {
		email,
		clientId,
		redirectUri,
		state,
		nonce,
		scope,
	});

	// Generate registration options using @simplewebauthn/server
	let registrationOptions = await generateRegistrationOptions({
		rpName,
		rpID: rpId,
		userName: email,
		userDisplayName: subject!.displayName ?? email,
		userID: new TextEncoder().encode(subject!.id),
		attestationType: "none",
		authenticatorSelection: {
			authenticatorAttachment: "platform",
			residentKey: "preferred",
			userVerification: "preferred",
		},
		challenge: new TextEncoder().encode(challenge),
	} satisfies GenerateRegistrationOptionsOpts);

	return ok({
		challengeId,
		options: registrationOptions,
	});
});
