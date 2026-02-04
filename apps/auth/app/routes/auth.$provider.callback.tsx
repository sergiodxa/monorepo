import { getClientIP } from "@pkg/get-client-ip";
import { redirectDocument } from "react-router";

import { badRequest } from "~/helpers/response";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { session } from "~/middleware/session";
import { github } from "~/providers/github";
import loginWithProvider from "~/services/login/with-provider";

import type { Route } from "./+types/auth.$provider.callback";

export async function loader({ request, params }: Route.LoaderArgs) {
	logger.info("oauth_callback_received", { provider: params.provider });

	let sub: string;

	if (params.provider === "github") {
		sub = await github(db(), request);
	} else {
		logger.warn("oauth_invalid_provider", { provider: params.provider });
		return badRequest({ message: "Invalid provider" });
	}

	let authz = session().get("authz");
	if (!authz) {
		logger.warn("oauth_missing_authz_session");
		return badRequest({ message: "Invalid request" });
	}

	let result = await loginWithProvider({
		subjectId: sub,
		clientId: authz.clientId,
		ip: getClientIP(request),
		ua: request.headers.get("user-agent"),
		redirectUri: authz.redirectUri,
		state: authz.state,
	});

	if (result.status === "success") {
		logger.info("oauth_login_success", { provider: params.provider, subjectId: sub });
		session().unset("authz"); // Remove the authz object from the session
		session().set("sub", sub); // Keep the subject logged-in for SSO
		return redirectDocument(result.data.url.toString());
	}

	logger.error("oauth_login_failed", { provider: params.provider, error: result.error.code });
	let url = new URL(authz.redirectUri);
	url.searchParams.set("state", authz.state);
	url.searchParams.set("error", result.error.code);
	url.searchParams.set("error_description", result.error.description);

	return redirectDocument(url.toString());
}

export default function Component({ loaderData }: Route.ComponentProps) {
	return (
		<main className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-md">
			<p>{loaderData.message}</p>
		</main>
	);
}
