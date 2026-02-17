import { getClientIP } from "@pkg/get-client-ip";
import { badRequest } from "@pkg/response";
import { href, redirect, redirectDocument } from "react-router";

import { AUTH_SERVER_CLIENT_ID } from "~/config";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { session } from "~/middleware/session";
import Client from "~/models/client";
import Session from "~/models/session";
import { github } from "~/providers/github";
import loginWithProvider from "~/services/login/with-provider";

import type { Route } from "./+types/auth.$provider.callback";

export async function loader({ request, params }: Route.LoaderArgs) {
	logger.info("oauth_callback_received", { provider: params.provider });

	let sub: string;

	if (params.provider === "github") {
		sub = await github(db(), request);
	} else {
		logger.info("oauth_invalid_provider", { provider: params.provider });
		return badRequest({ message: "Invalid provider" });
	}

	let authz = session().get("authz");

	// Standalone login: create a session for the auth server itself
	if (!authz) {
		// Ensure the auth server client exists
		await Client.ensureAuthServerClient(db());

		// Create a session for tracking
		let dbSession = await Session.create(
			db(),
			sub,
			AUTH_SERVER_CLIENT_ID,
			getClientIP(request),
			request.headers.get("user-agent"),
		);

		logger.info("oauth_standalone_login_success", { provider: params.provider, subjectId: sub });
		session().set("sub", sub);
		session().set("sessionId", dbSession.id);
		return redirect(href("/sessions"));
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
		<main className="dark:bg-gray-800 w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
			<p>{loaderData.message}</p>
		</main>
	);
}
