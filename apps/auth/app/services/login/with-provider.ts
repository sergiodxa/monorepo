import { failure, isFailure, success } from "@pkg/result";

import { ISSUER } from "~/config";
import { InternalServerError } from "~/errors";
import { logger } from "~/middleware/logger";
import { generateSessionState } from "~/utils/session-state";

import generateCode from "./generate-code";

interface Input {
	subjectId: string;
	clientId: string;
	ip: string | null;
	ua: string | null;
	redirectUri: string;
	state: string;
	nonce?: string;
	scope?: string[];
	opBrowserState?: string; // For OIDC Session Management
}

export default async function loginWithProvider(input: Input) {
	try {
		let result = await generateCode({
			subjectId: input.subjectId,
			clientId: input.clientId,
			ip: input.ip,
			ua: input.ua,
			nonce: input.nonce,
			scope: input.scope,
		});

		if (isFailure(result)) return result;

		let url = new URL(input.redirectUri);
		url.searchParams.set("state", input.state);
		url.searchParams.set("iss", ISSUER); // RFC 9207
		url.searchParams.set("code", result.data.code);

		// Add session_state for OIDC Session Management if opBrowserState is provided
		if (input.opBrowserState) {
			let sessionState = await generateSessionState(
				input.clientId,
				input.redirectUri,
				input.opBrowserState,
			);
			url.searchParams.set("session_state", sessionState);
		}

		logger.info("provider_login_code_generated", { subjectId: input.subjectId });
		return success({ url, subjectId: input.subjectId });
	} catch (error) {
		logger.error("provider_login_error", {
			error: error instanceof Error ? error.message : "Unknown error",
		});
		if (error instanceof Error) {
			return failure(new InternalServerError(error.message));
		}

		return failure(new InternalServerError());
	}
}
