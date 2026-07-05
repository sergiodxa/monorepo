/**
 * WebAuthn authentication verification endpoint controller.
 *
 * Consumes the challenge, verifies the passkey assertion, updates the signature
 * counter (replay protection), and — when the challenge carries OAuth params —
 * creates a session and authorization code to continue the flow.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, ok, tooManyRequests } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import TenantMeta from "../../management/models/tenant-meta";
import AuthorizationCode from "../../oauth/models/authorization-code";
import Session from "../../oauth/models/session";
import routes from "../../routes";
import { isResponse, safeJsonParse } from "../../shared/lib/safe-json";
import { checkUserRateLimit, USER_RATE_LIMITS } from "../../shared/lib/user-rate-limit";
import Subject from "../../subjects/models/subject";
import Passkey from "../models/passkey";
import WebAuthnChallenge from "../models/webauthn-challenge";

/** Validation schema for the WebAuthn authentication (assertion) response body. */
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

/**
 * WebAuthn authentication verification endpoint.
 * Verifies a passkey authentication response and creates a session.
 * Rate-limited per email to prevent brute force attacks.
 * Updates passkey counter after successful authentication to prevent replay attacks.
 * @returns A JSON `Response` with a redirect (OAuth flow) or subject info, or an error `Response`.
 */
export default createAction(
	routes.webauthn.auth.verify,
	inject([Database] as const, async (db) => {
		let { request, logger, analytics } = getContext();
		let log = logger.action("/webauthn/auth/verify");

		let body = await safeJsonParse(request);
		if (isResponse(body)) {
			log.info("Invalid JSON body");
			return body;
		}

		let result = await validate(body, RequestSchema);
		if (isFailure(result)) {
			log.info("Invalid request body");
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		let { challengeId, response } = result.data;
		log.info("Verifying authentication", { challengeId });

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

		if (!challenge.subject_id) {
			log.info("Challenge missing subject", { challengeId });
			return badRequest({ error: "Invalid challenge: missing subject" });
		}

		let subject = await Subject.show(db, challenge.subject_id);
		if (!subject) {
			log.info("Subject not found", { subjectId: challenge.subject_id, challengeId });
			return badRequest({ error: "User not found" });
		}

		let rateLimit = checkUserRateLimit(subject.email, "authVerify", USER_RATE_LIMITS.authVerify);
		if (!rateLimit.success) {
			log.info("Rate limit exceeded for subject", { subjectId: subject.id });
			return tooManyRequests({
				error: "Too many authentication attempts. Please try again later.",
				retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
			});
		}

		// response.id is the credential ID from the authenticator (base64url encoded)
		let passkey = await Passkey.findByCredentialId(db, response.id);
		if (!passkey || passkey.subject_id !== subject.id) {
			log.info("Passkey not found or mismatch", { subjectId: subject.id, challengeId });
			return badRequest({ error: "Passkey not found" });
		}

		let issuer = await TenantMeta.getIssuer(db);
		let rpId = issuer ? new URL(`https://${issuer}`).hostname : new URL(request.url).hostname;
		let origin = new URL(request.url).origin;

		let publicKeyBytes = Uint8Array.from(atob(passkey.public_key), (c) => c.charCodeAt(0));

		let verification;
		try {
			verification = await verifyAuthenticationResponse({
				response: response as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
				expectedChallenge: challenge.challenge,
				expectedOrigin: origin,
				expectedRPID: rpId,
				credential: {
					// Non-null: this passkey was just located by matching credential_id
					// against response.id above.
					id: passkey.credential_id!,
					publicKey: publicKeyBytes,
					counter: passkey.counter,
					transports: passkey.transports
						? (passkey.transports.split(",") as AuthenticatorTransport[])
						: undefined,
				},
				requireUserVerification: false,
			});
		} catch (error) {
			log.info("Authentication verification failed", {
				subjectId: subject.id,
				challengeId,
				error: error instanceof Error ? error.message : "Unknown error",
			});
			return badRequest({ error: "Authentication failed" });
		}

		if (!verification.verified || !verification.authenticationInfo) {
			log.info("Authentication not verified", { subjectId: subject.id, challengeId });
			return badRequest({ error: "Authentication failed" });
		}

		await Passkey.updateCounter(db, passkey.id, verification.authenticationInfo.newCounter);

		let tenantId = await TenantMeta.getTenantId(db);
		if (tenantId) {
			analytics.trackAuthentication(tenantId, subject.id);
		}

		if (challenge.client_id && challenge.redirect_uri) {
			let sessionId = await Session.create(db, {
				subjectId: subject.id,
				clientId: challenge.client_id,
				ip: request.headers.get("cf-connecting-ip"),
				userAgent: request.headers.get("user-agent"),
			});

			let code = await AuthorizationCode.create(db, {
				clientId: challenge.client_id,
				subjectId: subject.id,
				sessionId,
				redirectUri: challenge.redirect_uri,
				scope: challenge.scope?.split(" "),
				nonce: challenge.nonce ?? undefined,
				pkce:
					challenge.pkce_challenge && challenge.pkce_method
						? {
								challenge: challenge.pkce_challenge,
								method: challenge.pkce_method === "plain" ? "plain" : "S256",
							}
						: undefined,
			});

			let redirectUrl = new URL(challenge.redirect_uri);
			redirectUrl.searchParams.set("code", code);
			if (challenge.state) {
				redirectUrl.searchParams.set("state", challenge.state);
			}

			log.info("Authentication completed with OAuth flow", {
				subjectId: subject.id,
				clientId: challenge.client_id,
				sessionId,
			});

			return ok({
				success: true,
				redirect: redirectUrl.toString(),
			});
		}

		log.info("Authentication completed", { subjectId: subject.id });

		return ok({
			success: true,
			subjectId: subject.id,
			email: subject.email,
		});
	}),
);
