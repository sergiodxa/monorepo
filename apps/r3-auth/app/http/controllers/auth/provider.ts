/**
 * Starting an external sign-in. A `POST` from the sign-in page's provider button parks
 * the OAuth transaction in this server's session and redirects to the provider; an
 * unknown provider goes back to the authorization endpoint rather than erroring, since
 * the only way to reach it is a stale or hand-written form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getClientIP } from "@pkg/get-client-ip";
import { redirect } from "@pkg/http/response";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { startGitHubLogin } from "~/app/services/github-login";
import { spendRateLimit } from "~/app/services/rate-limit";
import RateLimiters from "~/app/services/rate-limiters";
import routes from "~/routes/web";

/** POST /auth/:provider — begins the external sign-in flow for the named provider. */
export default createAction(
	routes.auth.provider,
	inject([RateLimiters] as const, async (limiters) => {
		let ctx = getContext();

		// The login budget, not the authorize one: every attempt here ends in a session
		// being created, so it is spent from the same allowance password attempts use.
		let limited = await spendRateLimit(limiters.login, getClientIP(ctx.request) ?? "unknown");
		if (limited) return limited;

		if (ctx.params.provider !== "github") {
			ctx.logger.info("oauth_invalid_provider", { provider: ctx.params.provider });
			return redirect(routes.authorize.index.href(), { status: redirect.Status.SeeOther });
		}

		ctx.logger.info("oauth_login_started", { provider: "github" });

		return await startGitHubLogin(ctx);
	}),
);
