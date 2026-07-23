/**
 * The auth server's own OAuth callback route (/auth/callback), used when the auth app
 * logs in as its own OIDC client. Its loader validates the returned code and state
 * against the stored authz session, exchanges the authorization code for tokens,
 * persists the access and refresh tokens in the cookie session, and redirects to the
 * account sessions page. Exists to complete the auth server's self-login flow.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest } from "@pkg/response";
import { Card } from "@pkg/ui";
import { useTranslation } from "react-i18next";
import { href, redirect } from "react-router";

import { AUTH_SERVER_CLIENT_ID } from "~/config";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { session } from "~/middleware/session";
import Client from "~/models/client";
import oidc from "~/services/oidc";

import type { Route } from "./+types/route";

export async function loader({ request }: Route.LoaderArgs) {
	let url = new URL(request.url);
	let code = url.searchParams.get("code");
	let state = url.searchParams.get("state");

	if (!code || !state) {
		logger.info("auth_callback_missing_params");
		return badRequest({ message: "Missing code or state parameter" });
	}

	let authz = session().get("authz");
	if (!authz) {
		logger.info("auth_callback_missing_authz");
		return badRequest({ message: "Invalid request - no authorization session" });
	}

	if (authz.state !== state) {
		logger.info("auth_callback_state_mismatch");
		return badRequest({ message: "Invalid state parameter" });
	}

	if (authz.clientId !== AUTH_SERVER_CLIENT_ID) {
		logger.info("auth_callback_wrong_client", { clientId: authz.clientId });
		return badRequest({ message: "Invalid client" });
	}

	let client = await Client.findById(db(), AUTH_SERVER_CLIENT_ID);
	if (!client) {
		logger.error("auth_callback_client_not_found");
		return badRequest({ message: "Auth server client not found" });
	}

	try {
		let tokens = (await oidc.token({
			type: "authorization_code",
			code,
			redirectUri: authz.redirectUri,
		})) as unknown as { access_token: string; refresh_token: string; expires_in: number };

		session().unset("authz");
		session().set("accessToken", tokens.access_token);
		session().set("refreshToken", tokens.refresh_token);

		logger.info("auth_callback_success");
		return redirect(href("/account/sessions"));
	} catch (error) {
		logger.error("auth_callback_token_exchange_failed", {
			error: error instanceof Error ? error.message : "Unknown error",
		});
		return badRequest({ message: "Failed to exchange authorization code" });
	}
}

export default function Component({ loaderData }: Route.ComponentProps) {
	let { t } = useTranslation();

	if (!loaderData.ok) {
		return (
			<main className="flex min-h-dvh items-center justify-center p-6">
				<Card className="w-full max-w-md">
					<Card.Header>
						<Card.Title>{t("authorize.errors.invalidRequest.title")}</Card.Title>
						<Card.Description>{loaderData.message}</Card.Description>
					</Card.Header>
				</Card>
			</main>
		);
	}

	return null;
}
