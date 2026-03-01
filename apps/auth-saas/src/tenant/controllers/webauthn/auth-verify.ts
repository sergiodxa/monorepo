import { badRequest, ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
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
			authenticatorData: s.string(),
			signature: s.string(),
			userHandle: s.optional(s.string()),
		}),
		authenticatorAttachment: s.optional(s.string()),
		clientExtensionResults: s.optional(s.record(s.string(), s.any())),
		type: s.literal("public-key"),
	}),
});

export default action<"POST", "/webauthn/auth/verify">(async ({ db, request, logger }) => {
	let log = logger.action("/webauthn/auth/verify");

	let body = (await request.json()) as Record<string, unknown>;
	let result = await validate(body, RequestSchema);
	if (isFailure(result)) {
		log.info("Invalid request body");
		return badRequest({ error: "Invalid request", issues: result.error.issues });
	}

	let { challengeId, response } = result.data;
	log.info("Verifying authentication", { challengeId });

	// Consume the challenge (single-use)
	let challenge;
	try {
		challenge = await WebAuthnChallenge.consume(db, challengeId);
	} catch (error) {
		if (error instanceof WebAuthnChallenge.InvalidChallengeError) {
			log.info("Invalid challenge", { challengeId });
			return badRequest({ error: "Invalid challenge" });
		}
		if (error instanceof WebAuthnChallenge.ExpiredChallengeError) {
			log.info("Challenge expired", { challengeId });
			return badRequest({ error: "Challenge expired. Please try again." });
		}
		throw error;
	}

	if (challenge.type !== "authentication") {
		log.info("Invalid challenge type", { challengeId, type: challenge.type });
		return badRequest({ error: "Invalid challenge type" });
	}

	if (!challenge.subjectId) {
		log.info("Challenge missing subject", { challengeId });
		return badRequest({ error: "Invalid challenge: missing subject" });
	}

	// Get subject
	let subject = await Subject.show(db, { id: challenge.subjectId });
	if (!subject) {
		log.info("Subject not found", { subjectId: challenge.subjectId, challengeId });
		return badRequest({ error: "User not found" });
	}

	// Find the passkey being used
	let passkey = await Passkey.show(db, response.id);
	if (!passkey || passkey.subjectId !== subject.id) {
		log.info("Passkey not found or mismatch", { subjectId: subject.id, challengeId });
		return badRequest({ error: "Passkey not found" });
	}

	// Get RP info
	let issuer = await TenantMeta.getIssuer(db);
	let rpId = issuer ? new URL(`https://${issuer}`).hostname : new URL(request.url).hostname;
	let origin = new URL(request.url).origin;

	// Decode the stored public key
	let publicKeyBytes = Uint8Array.from(atob(passkey.publicKey), (c) => c.charCodeAt(0));

	// Verify the authentication response
	let verification;
	try {
		verification = await verifyAuthenticationResponse({
			response: response as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
			expectedChallenge: challenge.challenge,
			expectedOrigin: origin,
			expectedRPID: rpId,
			authenticator: {
				credentialID: passkey.id,
				credentialPublicKey: publicKeyBytes,
				counter: passkey.counter,
				transports: passkey.transports
					? (passkey.transports.split(",") as AuthenticatorTransport[])
					: undefined,
			},
			requireUserVerification: true,
		});
	} catch (error) {
		log.info("Authentication verification failed", {
			subjectId: subject.id,
			challengeId,
			error: error instanceof Error ? error.message : "Unknown error",
		});
		return badRequest({
			error: "Authentication failed",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}

	if (!verification.verified || !verification.authenticationInfo) {
		log.info("Authentication not verified", { subjectId: subject.id, challengeId });
		return badRequest({ error: "Authentication failed" });
	}

	// Update passkey counter to prevent replay attacks
	await Passkey.updateCounter(db, passkey.id, verification.authenticationInfo.newCounter);

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

		log.info("Authentication completed with OAuth flow", {
			subjectId: subject.id,
			clientId: challenge.clientId,
			sessionId,
		});

		return ok({
			success: true,
			redirect: redirectUrl.toString(),
		});
	}

	// Direct authentication without OAuth flow
	log.info("Authentication completed", { subjectId: subject.id });

	return ok({
		success: true,
		subjectId: subject.id,
	});
});
