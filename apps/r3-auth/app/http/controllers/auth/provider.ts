/**
 * Starting an external sign-in. A `POST` from the sign-in page's provider button parks
 * the OAuth transaction in this server's session and redirects to the provider; an
 * unknown provider is sent back to the authorization endpoint, since the only way to
 * reach it is a stale or hand-written form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getClientIP } from "@sdxc/get-client-ip";
import { redirect } from "@sdxc/http/response";
import { inject } from "@sdxc/service-container";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { startGitHubLogin } from "~/app/services/github-login";
import { spendRateLimit } from "~/app/services/rate-limit";
import RateLimiters from "~/app/services/rate-limiters";
import routes from "~/routes/web";

/**
 * POST /auth/:provider — begins the external sign-in flow for the named provider.
 * Attempts spend the login rate-limit budget, the same allowance password sign-ins
 * use, because every attempt here ends in a session being created.
 */
export default createAction(
	routes.auth.provider,
	inject([RateLimiters] as const, async (limiters) => {
		let ctx = getContext();

		let limited = await spendRateLimit(limiters.login, getClientIP(ctx.request) ?? "unknown");
		if (limited) return limited;

		if (ctx.params.provider !== "github") {
			ctx.log.note("auth.provider.unknown", { provider: ctx.params.provider });
			return redirect(routes.authorize.index.href(), { status: redirect.Status.SeeOther });
		}

		ctx.log.set({ auth: { provider: "github" } });
		ctx.log.note("auth.login_started");

		return await startGitHubLogin(ctx);
	}),
);
