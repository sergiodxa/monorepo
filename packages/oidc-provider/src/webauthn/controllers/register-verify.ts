/**
 * WebAuthn registration verification endpoint controller.
 *
 * Consumes the challenge, verifies the new passkey, creates the subject and stores
 * the credential (implicitly verifying email ownership), and — when the challenge
 * carries OAuth params — creates a session and authorization code to continue.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, ok, tooManyRequests } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import TenantMeta from "../../management/models/tenant-meta";
import AuthorizationCode from "../../oauth/models/authorization-code";
import Session from "../../oauth/models/session";
import routes from "../../routes";
import { isResponse, safeJsonParse } from "../../shared/lib/safe-json";
import { generatePasskeyName } from "../../shared/lib/user-agent";
import { checkUserRateLimit, USER_RATE_LIMITS } from "../../shared/lib/user-rate-limit";
import Subject from "../../subjects/models/subject";
import Passkey from "../models/passkey";
import WebAuthnChallenge from "../models/webauthn-challenge";

/** Validation schema for the WebAuthn registration (attestation) response body. */
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

/**
 * WebAuthn registration verification endpoint.
 * Verifies a passkey registration response and stores the credential.
 * Rate-limited per email to prevent registration abuse.
 * Passkey registration implicitly verifies email ownership.
 * @returns A JSON `Response` with a redirect (OAuth flow) or subject info, or an error `Response`.
 */
export default createAction(
	routes.webauthn.register.verify,
	inject([Database] as const, async (db) => {
		let { request, logger, analytics } = getContext();
		let log = logger.action("/webauthn/register/verify");

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
		log.info("Verifying registration", { challengeId });

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

		if (challenge.type !== "registration") {
			log.info("Invalid challenge type", { challengeId, type: challenge.type });
			return badRequest({ error: "Invalid challenge type" });
		}

		if (!challenge.email) {
			log.info("Challenge missing email", { challengeId });
			return badRequest({ error: "Invalid challenge: missing email" });
		}

		let rateLimit = checkUserRateLimit(
			challenge.email,
			"registerVerify",
			USER_RATE_LIMITS.registerVerify,
		);
		if (!rateLimit.success) {
			log.info("Rate limit exceeded for email", { email: challenge.email });
			return tooManyRequests({
				error: "Too many registration attempts. Please try again later.",
				retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
			});
		}

		let issuer = await TenantMeta.getIssuer(db);
		let rpId = issuer ? new URL(`https://${issuer}`).hostname : new URL(request.url).hostname;
		let origin = new URL(request.url).origin;

		let verification;
		try {
			verification = await verifyRegistrationResponse({
				response: response as Parameters<typeof verifyRegistrationResponse>[0]["response"],
				expectedChallenge: challenge.challenge,
				expectedOrigin: origin,
				expectedRPID: rpId,
				requireUserVerification: false,
			});
		} catch (error) {
			log.info("Passkey verification failed", {
				challengeId,
				error: error instanceof Error ? error.message : "Unknown error",
			});
			return badRequest({ error: "Passkey verification failed" });
		}

		if (!verification.verified || !verification.registrationInfo) {
			log.info("Passkey verification not verified", { challengeId });
			return badRequest({ error: "Passkey verification failed" });
		}

		let { registrationInfo } = verification;

		// Registration only ever creates a brand-new subject. If one already exists for
		// this email (e.g. an imported user, or an account created on another device),
		// attaching a passkey from an unauthenticated registration ceremony would be an
		// account-takeover vector — that email must prove ownership via magic link
		// before a passkey can be added. Reject here as defense in depth even though the
		// /authorize check only offers registration for unknown emails.
		let existing = await Subject.findByEmail(db, challenge.email);
		if (existing) {
			log.info("Registration attempted for existing subject", { subjectId: existing.id });
			return badRequest({
				error: "An account with this email already exists. Sign in with your email instead.",
			});
		}

		let username = challenge.email.split("@")[0] ?? challenge.email;
		let subject = await Subject.register(db, { email: challenge.email, username });
		log.info("Created new subject during registration", { subjectId: subject.id });

		let userAgent = request.headers.get("user-agent");
		let passkeyName = generatePasskeyName(userAgent);

		await Passkey.create(db, {
			subjectId: subject.id,
			// credential.id is already a Base64URLString from @simplewebauthn
			credentialId: registrationInfo.credential.id,
			publicKey: Buffer.from(registrationInfo.credential.publicKey).toString("base64"),
			counter: registrationInfo.credential.counter,
			deviceType: registrationInfo.credentialDeviceType,
			backedUp: registrationInfo.credentialBackedUp,
			transports: response.response.transports?.join(",") ?? null,
			name: passkeyName,
		});

		log.info("Passkey created", {
			subjectId: subject.id,
			deviceType: registrationInfo.credentialDeviceType,
			backedUp: registrationInfo.credentialBackedUp,
		});

		if (!subject.email_verified_at) {
			await Subject.verifyEmail(db, subject.id);
			log.info("Email verified via passkey registration", { subjectId: subject.id });
		}

		let tenantId = await TenantMeta.getTenantId(db);
		if (tenantId) {
			analytics.trackRegistration(tenantId, subject.id);
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

			log.info("Registration completed with OAuth flow", {
				subjectId: subject.id,
				clientId: challenge.client_id,
				sessionId,
			});

			return ok({
				success: true,
				redirect: redirectUrl.toString(),
			});
		}

		log.info("Registration completed", { subjectId: subject.id });

		return ok({
			success: true,
			subjectId: subject.id,
			email: subject.email,
		});
	}),
);
