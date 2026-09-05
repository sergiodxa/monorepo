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

import { badRequest, ok, tooManyRequests } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import { inject } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import TenantMeta from "../../management/models/tenant-meta.js";
import AuthorizationCode from "../../oauth/models/authorization-code.js";
import Session from "../../oauth/models/session.js";
import routes from "../../routes.js";
import { isResponse, safeJsonParse } from "../../shared/lib/safe-json.js";
import { checkUserRateLimit, USER_RATE_LIMITS } from "../../shared/lib/user-rate-limit.js";
import Subject from "../../subjects/models/subject.js";
import Passkey from "../models/passkey.js";
import WebAuthnChallenge from "../models/webauthn-challenge.js";

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
 * Verifies a passkey authentication response, rate-limited per email, and
 * updates the passkey's signature counter to guard against replay before
 * establishing a session.
 * @returns A JSON `Response` with a redirect (OAuth flow) or subject info, or an error `Response`.
 */
export default createAction(
	routes.webauthn.auth.verify,
	inject([Database] as const, async (db) => {
		let { request, log, analytics } = getContext();

		let body = await safeJsonParse(request);
		if (isResponse(body)) {
			log.warn("http.invalid_json");
			return body;
		}

		let result = await validate(body, RequestSchema);
		if (isFailure(result)) {
			log.warn("http.invalid_body");
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		let { challengeId, response } = result.data;
		log.set({ webauthn: { challenge_id: challengeId } });

		let challenge;
		try {
			challenge = await WebAuthnChallenge.consume(db, challengeId);
		} catch (error) {
			if (error instanceof WebAuthnChallenge.InvalidChallengeError) {
				log.warn("webauthn.challenge_invalid");
				return badRequest({ error: "Invalid challenge" });
			}
			if (error instanceof WebAuthnChallenge.ExpiredChallengeError) {
				log.warn("webauthn.challenge_expired");
				return badRequest({ error: "Challenge expired. Please try again." });
			}
			throw error;
		}

		if (challenge.type !== "authentication") {
			log.warn("webauthn.challenge_type_mismatch", { type: challenge.type });
			return badRequest({ error: "Invalid challenge type" });
		}

		if (!challenge.subject_id) {
			log.warn("webauthn.auth.challenge_subject_missing");
			return badRequest({ error: "Invalid challenge: missing subject" });
		}

		let subject = await Subject.show(db, challenge.subject_id);
		if (!subject) {
			log.warn("subject.not_found", { subject_id: challenge.subject_id });
			return badRequest({ error: "User not found" });
		}
		log.set({ subject: { id: subject.id } });

		let rateLimit = checkUserRateLimit(subject.email, "authVerify", USER_RATE_LIMITS.authVerify);
		if (!rateLimit.success) {
			log.warn("webauthn.rate_limited");
			return tooManyRequests({
				error: "Too many authentication attempts. Please try again later.",
				retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
			});
		}

		/**
		 * response.id is the base64url credential ID reported by the authenticator;
		 * matching it here guarantees the returned passkey's credential_id is set,
		 * which the verification call below asserts non-null.
		 */
		let passkey = await Passkey.findByCredentialId(db, response.id);
		if (!passkey || passkey.subject_id !== subject.id) {
			log.warn("webauthn.auth.passkey_mismatch");
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
			log.warn("webauthn.auth.verification_failed", {
				error: error instanceof Error ? error.message : "Unknown error",
			});
			return badRequest({ error: "Authentication failed" });
		}

		if (!verification.verified || !verification.authenticationInfo) {
			log.warn("webauthn.auth.not_verified");
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

			log.set({ client: { id: challenge.client_id } });
			log.note("webauthn.auth.completed", { session_id: sessionId, oauth: true });

			return ok({
				success: true,
				redirect: redirectUrl.toString(),
			});
		}

		log.note("webauthn.auth.completed", { oauth: false });

		return ok({
			success: true,
			subjectId: subject.id,
			email: subject.email,
		});
	}),
);
