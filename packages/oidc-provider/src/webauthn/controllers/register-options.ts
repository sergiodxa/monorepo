/**
 * WebAuthn registration options endpoint controller.
 *
 * Validates and rate-limits the email and ensures it has no existing passkey, then
 * issues a single-use challenge plus the creation options for the browser's WebAuthn
 * `create` ceremony. The subject itself is not persisted here — it is created during
 * verification, only after the attestation is cryptographically verified.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, ok, tooManyRequests } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import {
	generateRegistrationOptions,
	type GenerateRegistrationOptionsOpts,
} from "@simplewebauthn/server";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import TenantMeta from "../../management/models/tenant-meta";
import routes from "../../routes";
import { base64UrlDecode } from "../../shared/lib/base64url";
import { checkUserRateLimit, USER_RATE_LIMITS } from "../../shared/lib/user-rate-limit";
import Subject from "../../subjects/models/subject";
import Passkey from "../models/passkey";
import WebAuthnChallenge from "../models/webauthn-challenge";

/** Validation schema for the registration-options request body. */
let RequestSchema = s.object({
	email: s.string(),
	clientId: s.optional(s.string()),
	redirectUri: s.optional(s.string()),
	state: s.optional(s.string()),
	nonce: s.optional(s.string()),
	scope: s.optional(s.string()),
});

/**
 * Basic email format validation (RFC 5322 simplified).
 * @param email - The email address to check.
 * @returns True if the email has a plausible `local@domain.tld` shape.
 */
function isValidEmail(email: string): boolean {
	let parts = email.split("@");
	if (parts.length !== 2) return false;
	let [local, domain] = parts;
	if (!local || !domain) return false;
	if (local.length === 0 || domain.length === 0) return false;
	if (!domain.includes(".")) return false;
	if (email.includes(" ")) return false;
	return true;
}

/**
 * WebAuthn registration options endpoint.
 * Generates a challenge for passkey registration.
 * Rate-limited per email to prevent registration abuse.
 * @returns A JSON `Response` with `{ challengeId, options }`, or an error `Response`.
 */
export default createAction(
	routes.webauthn.register.options,
	inject([Database] as const, async (db) => {
		let { formData, request, logger } = getContext();
		let log = logger.action("/webauthn/register/options");

		let result = await validate(Object.fromEntries(formData), RequestSchema);
		if (isFailure(result)) {
			log.info("Invalid request body");
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		let { email, clientId, redirectUri, state, nonce, scope } = result.data;

		if (!isValidEmail(email)) {
			log.info("Invalid email format", { email });
			return badRequest({ error: "Invalid email format" });
		}

		let rateLimit = checkUserRateLimit(email, "registerOptions", USER_RATE_LIMITS.registerOptions);
		if (!rateLimit.success) {
			log.info("Rate limit exceeded for email", { email });
			return tooManyRequests({
				error: "Too many registration attempts. Please try again later.",
				retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
			});
		}

		// Look up any existing subject only to reject when it already has a passkey
		// (that account should sign in, not register). Crucially, do NOT persist a new
		// subject here: registration is completed by /webauthn/register/verify, which
		// creates the subject only after the attestation is cryptographically verified.
		// Persisting during options generation made the normal options->verify flow fail
		// because verify rejects when a subject with this email already exists.
		let existingSubject = await Subject.findByEmail(db, email);
		if (existingSubject) {
			let existingPasskeys = await Passkey.listBySubject(db, existingSubject.id);
			if (existingPasskeys.length > 0) {
				log.info("Subject already has passkey", { subjectId: existingSubject.id });
				return badRequest({ error: "User already has a passkey. Please sign in instead." });
			}
		}

		let issuer = await TenantMeta.getIssuer(db);
		let rpId = issuer ? new URL(`https://${issuer}`).hostname : new URL(request.url).hostname;
		let rpName = rpId;

		// `userId` is a fresh random WebAuthn user handle bound to this challenge; it is
		// uncorrelated with the email/PII (per WebAuthn guidance) and is what the
		// authenticator stores for a discoverable credential.
		let {
			id: challengeId,
			challenge,
			userId,
		} = await WebAuthnChallenge.createForRegistration(db, {
			email,
			clientId,
			redirectUri,
			state,
			nonce,
			scope,
		});

		let displayName = existingSubject?.display_name ?? email;

		let registrationOptions = await generateRegistrationOptions({
			rpName,
			rpID: rpId,
			userName: email,
			userDisplayName: displayName,
			userID: new Uint8Array(base64UrlDecode(userId)),
			attestationType: "none",
			authenticatorSelection: {
				residentKey: "preferred",
				userVerification: "preferred",
			},
			// Copy into a Uint8Array backed by a plain ArrayBuffer to satisfy the
			// current @simplewebauthn BufferSource typing.
			challenge: new Uint8Array(base64UrlDecode(challenge)),
		} satisfies GenerateRegistrationOptionsOpts);

		log.info("Registration challenge created", {
			challengeId,
			clientId: clientId ?? null,
			hasRedirectUri: !!redirectUri,
		});

		return ok({
			challengeId,
			options: registrationOptions,
		});
	}),
);
