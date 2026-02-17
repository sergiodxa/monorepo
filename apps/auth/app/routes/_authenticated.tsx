import { href, Outlet, redirect } from "react-router";

import { logger } from "~/middleware/logger";
import { session } from "~/middleware/session";
import oidc from "~/services/oidc";
import { isAccessTokenExpiringSoon } from "~/utils/decode-access-token";

import type { Route } from "./+types/_authenticated";

export const middleware: Route.MiddlewareFunction[] = [
	async (args, next) => {
		let accessToken = session().get("accessToken");
		let refreshToken = session().get("refreshToken");

		if (!accessToken || !refreshToken) {
			logger.info("auth_middleware_no_tokens");
			return redirect(href("/authorize"));
		}

		try {
			if (isAccessTokenExpiringSoon(accessToken)) {
				logger.info("auth_middleware_refreshing_token");

				let tokens = (await oidc.token({
					type: "refresh_token",
					refreshToken,
				})) as { access_token: string; refresh_token: string; expires_in: number };

				session().set("accessToken", tokens.access_token);
				session().set("refreshToken", tokens.refresh_token);

				logger.info("auth_middleware_token_refreshed");
			}
		} catch (error) {
			logger.error("auth_middleware_refresh_failed", {
				error: error instanceof Error ? error.message : "Unknown error",
			});
			session().unset("accessToken");
			session().unset("refreshToken");
			return redirect(href("/authorize"));
		}

		return next();
	},
];

export default function AuthenticatedLayout() {
	return <Outlet />;
}
