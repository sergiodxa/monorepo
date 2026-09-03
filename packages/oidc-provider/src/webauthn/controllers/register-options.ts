/**
 * WebAuthn registration options endpoint controller.
 *
 * Validates and rate-limits the email, then issues a single-use challenge and
 * creation options for the WebAuthn `create` ceremony; the subject is created
 * only once verification confirms the attestation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, ok, tooManyRequests } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import { inject } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import {
	generateRegistrationOptions,
	type GenerateRegistrationOptionsOpts,
} from "@simplewebauthn/server";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import TenantMeta from "../../management/models/tenant-meta.js";
import routes from "../../routes.js";
import { base64UrlDecode } from "../../shared/lib/base64url.js";
import { checkUserRateLimit, USER_RATE_LIMITS } from "../../shared/lib/user-rate-limit.js";
import Subject from "../../subjects/models/subject.js";
import Passkey from "../models/passkey.js";
import WebAuthnChallenge from "../models/webauthn-challenge.js";

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
 * Rejects an email that already holds a passkey, directing that account to
 * sign in, and rate-limits attempts per email to guard against registration
 * abuse.
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

		/**
		 * Existing subjects are looked up only to catch an email that already has
		 * a passkey; the subject record is created during verification, since
		 * verify rejects an email that already resolves to a subject.
		 */
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

		/**
		 * A fresh random WebAuthn user handle bound to this challenge, uncorrelated
		 * with the email per WebAuthn guidance; the authenticator stores it for a
		 * discoverable credential.
		 */
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
			/**
			 * Copied into a Uint8Array backed by a plain ArrayBuffer to satisfy
			 * the `@simplewebauthn/server` `BufferSource` typing.
			 */
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
