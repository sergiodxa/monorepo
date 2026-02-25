import { failure, success } from "@pkg/result";

import { ISSUER } from "~/config";
import AuthzCode from "~/entities/authz-code";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import Grant from "~/models/grant";
import Session from "~/models/session";
import { OIDCProvider } from "~/modules/oauth2";
import { generateSessionState } from "~/utils/session-state";

interface Input {
	subjectId: string;
	clientId: string;
	ip: string | null;
	ua: string | null;
	redirectUri: string;
	state: string;
	nonce?: string | null;
	scope?: string[];
	opBrowserState?: string;
	responseMode?: "query" | "fragment" | "form_post";
}

/**
 * Generates an authorization code and builds the OAuth response.
 * Creates a session and grant for the subject-client pair.
 *
 * Returns the response data needed to complete the OAuth flow:
 * - redirectUri: Where to redirect
 * - params: Query/form parameters (code, state, iss, etc.)
 * - responseMode: How to send the response (query, fragment, form_post)
 */
export default async function generateAuthzCode(input: Input) {
	try {
		// auth_time is the time of authentication (now, as we're creating a new session)
		let authTime = Math.floor(Date.now() / 1000);

		let [{ id: sessionId }, grant] = await Promise.all([
			Session.create(db(), input.subjectId, input.clientId, input.ip, input.ua),
			Grant.findOrCreate(db(), input.subjectId, input.clientId),
		]);
		logger.info("session_created", {
			sessionId,
			subjectId: input.subjectId,
			grantId: grant.id,
		});

		let code = await AuthzCode.generate(
			input.clientId,
			input.subjectId,
			sessionId,
			null,
			input.nonce,
			input.scope,
			authTime,
		);
		logger.info("authz_code_generated", { subjectId: input.subjectId, clientId: input.clientId });

		// Build OAuth response params
		let params: Record<string, string> = {
			code,
			state: input.state,
			iss: ISSUER, // RFC 9207 - Authorization Server Issuer Identification
		};

		// Add session_state for OIDC Session Management
		if (input.opBrowserState) {
			params.session_state = await generateSessionState(
				input.clientId,
				input.redirectUri,
				input.opBrowserState,
			);
		}

		return success({
			redirectUri: input.redirectUri,
			params,
			responseMode: input.responseMode ?? "query",
			subjectId: input.subjectId,
		});
	} catch (error) {
		logger.error("authz_code_generation_error", {
			error: error instanceof Error ? error.message : "Unknown error",
		});
		if (error instanceof Error) {
			return failure(new OIDCProvider.InternalServerError(error.message));
		}

		return failure(new OIDCProvider.InternalServerError());
	}
}
