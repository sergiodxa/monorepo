import { badRequest, ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import * as s from "remix/data-schema";

import action from "~/lib/action";
import AuthorizationCode from "~/tenant/models/authorization-code";
import Passkey from "~/tenant/models/passkey";
import Session from "~/tenant/models/session";
import Subject from "~/tenant/models/subject";
import TenantMeta from "~/tenant/models/tenant-meta";
import WebAuthnChallenge from "~/tenant/models/webauthn-challenge";

let RequestSchema = s.object({
	challengeId: s.string(),
	response: s.object({
		id: s.string(),
		rawId: s.string(),
		response: s.object({
			clientDataJSON: s.string(),
			attestationObject: s.string(),
			transports: s.optional(s.array(s.string())),
			publicKeyAlgorithm: s.optional(s.number()),
			publicKey: s.optional(s.string()),
			authenticatorData: s.optional(s.string()),
		}),
		authenticatorAttachment: s.optional(s.string()),
		clientExtensionResults: s.optional(s.record(s.string(), s.any())),
		type: s.literal("public-key"),
	}),
});

export default action<"POST", "/webauthn/register/verify">(async ({ db, request }) => {
	let body = (await request.json()) as Record<string, unknown>;
	let result = await validate(body, RequestSchema);
	if (isFailure(result)) {
		return badRequest({ error: "Invalid request", issues: result.error.issues });
	}

	let { challengeId, response } = result.data;

	// Consume the challenge (single-use)
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

	// Get RP info
	let issuer = await TenantMeta.getIssuer(db);
	let rpId = issuer ? new URL(`https://${issuer}`).hostname : new URL(request.url).hostname;
	let origin = new URL(request.url).origin;

	// Verify the registration response
	let verification;
	try {
		verification = await verifyRegistrationResponse({
			response: response as Parameters<typeof verifyRegistrationResponse>[0]["response"],
			expectedChallenge: challenge.challenge,
			expectedOrigin: origin,
			expectedRPID: rpId,
			requireUserVerification: true,
		});
	} catch (error) {
		return badRequest({
			error: "Passkey verification failed",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}

	if (!verification.verified || !verification.registrationInfo) {
		return badRequest({ error: "Passkey verification failed" });
	}

	let { registrationInfo } = verification;

	// Find or create the subject
	let subject = await Subject.findByEmail(db, challenge.email);
	if (!subject) {
		let username = challenge.email.split("@")[0] ?? challenge.email;
		subject = await Subject.register(db, { email: challenge.email, username });
	}

	// Store the passkey - registrationInfo uses flat structure in simplewebauthn v11+
	await Passkey.create(db, {
		subjectId: subject.id,
		publicKey: Buffer.from(registrationInfo.credentialPublicKey).toString("base64"),
		counter: registrationInfo.counter,
		deviceType: registrationInfo.credentialDeviceType,
		backedUp: registrationInfo.credentialBackedUp,
		transports: response.response.transports?.join(",") ?? null,
		name: null,
	});

	// Mark email as verified (passkey registration proves email ownership)
	if (!subject.emailVerifiedAt) {
		await Subject.verifyEmail(db, { id: subject.id });
	}

	// If this is part of an OAuth flow, create session and authorization code
	if (challenge.clientId && challenge.redirectUri) {
		let sessionId = await Session.create(db, {
			subjectId: subject.id,
			clientId: challenge.clientId,
			ip: request.headers.get("cf-connecting-ip"),
			userAgent: request.headers.get("user-agent"),
		});

		let code = await AuthorizationCode.create(db, {
			clientId: challenge.clientId,
			subjectId: subject.id,
			sessionId,
			redirectUri: challenge.redirectUri,
			scope: challenge.scope?.split(" "),
			nonce: challenge.nonce ?? undefined,
		});

		// Build redirect URL with authorization code
		let redirectUrl = new URL(challenge.redirectUri);
		redirectUrl.searchParams.set("code", code);
		if (challenge.state) {
			redirectUrl.searchParams.set("state", challenge.state);
		}

		return ok({
			success: true,
			redirect: redirectUrl.toString(),
		});
	}

	// Direct registration without OAuth flow
	return ok({
		success: true,
		subjectId: subject.id,
	});
});
