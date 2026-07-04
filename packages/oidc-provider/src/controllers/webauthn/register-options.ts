import { badRequest, ok, tooManyRequests } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import {
	generateRegistrationOptions,
	type GenerateRegistrationOptionsOpts,
} from "@simplewebauthn/server";
import * as s from "remix/data-schema";

import action from "../../lib/action";
import { base64UrlDecode } from "../../lib/base64url";
import { checkUserRateLimit, USER_RATE_LIMITS } from "../../lib/user-rate-limit";
import Passkey from "../../models/passkey";
import Subject from "../../models/subject";
import TenantMeta from "../../models/tenant-meta";
import WebAuthnChallenge from "../../models/webauthn-challenge";

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
 */
export default action<"POST", "/webauthn/register/options">(
	async ({ db, formData, request, logger }) => {
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

		let existingSubject = await Subject.findByEmail(db, email);
		if (existingSubject) {
			let existingPasskeys = await Passkey.listBySubject(db, existingSubject.id);
			if (existingPasskeys.length > 0) {
				log.info("Subject already has passkey", { subjectId: existingSubject.id });
				return badRequest({ error: "User already has a passkey. Please sign in instead." });
			}
		}

		let subject: Awaited<ReturnType<typeof Subject.findByEmail>>;
		if (existingSubject) {
			subject = existingSubject;
			log.info("Using existing subject", { subjectId: existingSubject.id });
		} else {
			let username = email.split("@")[0] ?? email;
			subject = await Subject.register(db, { email, username });
			log.info("Created new subject", { subjectId: subject!.id });
		}

		let issuer = await TenantMeta.getIssuer(db);
		let rpId = issuer ? new URL(`https://${issuer}`).hostname : new URL(request.url).hostname;
		let rpName = rpId;

		let { id: challengeId, challenge } = await WebAuthnChallenge.createForRegistration(db, {
			email,
			clientId,
			redirectUri,
			state,
			nonce,
			scope,
		});

		let registrationOptions = await generateRegistrationOptions({
			rpName,
			rpID: rpId,
			userName: email,
			userDisplayName: subject!.display_name ?? email,
			userID: new TextEncoder().encode(subject!.id),
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
			subjectId: subject!.id,
			challengeId,
			clientId: clientId ?? null,
			hasRedirectUri: !!redirectUri,
		});

		return ok({
			challengeId,
			options: registrationOptions,
		});
	},
);
