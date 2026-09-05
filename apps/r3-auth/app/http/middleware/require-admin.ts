/**
 * Route guard for the admin area: everything {@link requireSubject} requires, plus the
 * `admin` role. A signed-in subject lacking the role is routed to their own account,
 * where only a role change can grant them access.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { redirect } from "@sdxc/http/response";

import requireSubject from "~/app/http/middleware/require-subject";
import routes from "~/routes/web";

/**
 * Requires a signed-in subject holding the `admin` role.
 *
 * Runs `requireSubject` itself, guaranteeing the session guard always runs ahead of
 * the admin check no matter how a controller wires its middleware.
 */
export const requireAdmin: Middleware = (ctx, next) => {
	/** The role check, run once `requireSubject` has resolved the subject. */
	return requireSubject(ctx, async () => {
		if (ctx.subject.role !== "admin") {
			ctx.log.note("session.admin_required");
			return redirect(routes.account.sessions.index.href(), { status: redirect.Status.SeeOther });
		}

		return await next();
	});
};

export default requireAdmin;
