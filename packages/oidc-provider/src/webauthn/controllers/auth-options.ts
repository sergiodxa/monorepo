import { badRequest, ok, tooManyRequests } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import {
	generateAuthenticationOptions,
	type GenerateAuthenticationOptionsOpts,
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

let RequestSchema = s.object({
	email: s.string(),
	clientId: s.optional(s.string()),
	redirectUri: s.optional(s.string()),
	state: s.optional(s.string()),
	nonce: s.optional(s.string()),
	scope: s.optional(s.string()),
});

/**
 * WebAuthn authentication options endpoint.
 * Generates a challenge for passkey authentication.
 * Rate-limited per email to prevent brute force attacks.
 */
export default createAction(
	routes.webauthn.auth.options,
	inject([Database] as const, async (db) => {
		let { formData, request, logger } = getContext();
		let log = logger.action("/webauthn/auth/options");

		let result = await validate(Object.fromEntries(formData), RequestSchema);
		if (isFailure(result)) {
			log.info("Invalid request body");
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		let { email, clientId, redirectUri, state, nonce, scope } = result.data;

		let rateLimit = checkUserRateLimit(email, "authOptions", USER_RATE_LIMITS.authOptions);
		if (!rateLimit.success) {
			log.info("Rate limit exceeded for email", { email });
			return tooManyRequests({
				error: "Too many authentication attempts. Please try again later.",
				retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
			});
		}

		let subject = await Subject.findByEmail(db, email);
		if (!subject) {
			log.info("Subject not found for authentication");
			return badRequest({ error: "No passkey found. Please register first." });
		}

		let passkeys = await Passkey.listBySubject(db, subject.id);
		if (passkeys.length === 0) {
			log.info("No passkeys found for subject", { subjectId: subject.id });
			return badRequest({ error: "No passkey found. Please register first." });
		}

		let issuer = await TenantMeta.getIssuer(db);
		let rpId = issuer ? new URL(`https://${issuer}`).hostname : new URL(request.url).hostname;

		let { id: challengeId, challenge } = await WebAuthnChallenge.createForAuthentication(db, {
			subjectId: subject.id,
			clientId,
			redirectUri,
			state,
			nonce,
			scope,
		});

		let allowCredentials = passkeys.map((passkey) => ({
			id: passkey.id,
			type: "public-key" as const,
			transports: passkey.transports
				? (passkey.transports.split(",") as AuthenticatorTransport[])
				: undefined,
		}));

		let authenticationOptions = await generateAuthenticationOptions({
			rpID: rpId,
			allowCredentials,
			userVerification: "preferred",
			// Copy into a Uint8Array backed by a plain ArrayBuffer to satisfy the
			// current @simplewebauthn BufferSource typing.
			challenge: new Uint8Array(base64UrlDecode(challenge)),
		} satisfies GenerateAuthenticationOptionsOpts);

		log.info("Authentication challenge created", {
			subjectId: subject.id,
			challengeId,
			clientId: clientId ?? null,
			passkeyCount: passkeys.length,
			hasRedirectUri: !!redirectUri,
		});

		return ok({
			challengeId,
			options: authenticationOptions,
		});
	}),
);
