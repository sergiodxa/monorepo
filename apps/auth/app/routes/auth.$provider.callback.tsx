import { getClientIP } from "@pkg/get-client-ip";
import { badRequest } from "@pkg/response";
import { redirectDocument } from "react-router";

import { ISSUER } from "~/config";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { session } from "~/middleware/session";
import { checkRateLimit, rateLimitResponse } from "~/modules/rate-limit";
import { github } from "~/providers/github";
import loginWithProvider from "~/services/login/with-provider";
import { generateOpBrowserState, OP_BROWSER_STATE_COOKIE } from "~/utils/session-state";

import type { Route } from "./+types/auth.$provider.callback";

export async function loader({ request, params }: Route.LoaderArgs) {
	logger.info("oauth_callback_received", { provider: params.provider });

	// Rate limit login callbacks by IP
	let ip = getClientIP(request) ?? "unknown";
	if (!(await checkRateLimit("LOGIN_RATE_LIMITER", ip))) {
		return rateLimitResponse();
	}

	let sub: string;

	if (params.provider === "github") {
		sub = await github(db(), request);
	} else {
		logger.info("oauth_invalid_provider", { provider: params.provider });
		return badRequest({ message: "Invalid provider" });
	}

	let authz = session().get("authz");
	if (!authz) {
		logger.info("oauth_missing_authz_session");
		return badRequest({ message: "Invalid request" });
	}

	// Generate or get OP browser state for session management
	let opBrowserState = generateOpBrowserState();

	let result = await loginWithProvider({
		subjectId: sub,
		clientId: authz.clientId,
		ip: getClientIP(request),
		ua: request.headers.get("user-agent"),
		redirectUri: authz.redirectUri,
		state: authz.state,
		nonce: authz.nonce,
		scope: authz.scope,
		opBrowserState,
	});

	if (result.status === "success") {
		logger.info("oauth_login_success", { provider: params.provider, subjectId: sub });

		// Set the OP browser state cookie for session management
		let cookieValue = `${OP_BROWSER_STATE_COOKIE}=${opBrowserState}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${60 * 60 * 24 * 30}`;

		return redirectDocument(result.data.url.toString(), {
			headers: { "Set-Cookie": cookieValue },
		});
	}

	logger.error("oauth_login_failed", { provider: params.provider, error: result.error.code });
	let url = new URL(authz.redirectUri);
	url.searchParams.set("state", authz.state);
	url.searchParams.set("iss", ISSUER); // RFC 9207
	url.searchParams.set("error", result.error.code);
	url.searchParams.set("error_description", result.error.description);

	return redirectDocument(url.toString());
}

export default function Component({ loaderData }: Route.ComponentProps) {
	return (
		<main className="dark:bg-gray-800 w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
			<p>{loaderData.message}</p>
		</main>
	);
}
