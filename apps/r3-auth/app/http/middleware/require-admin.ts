/**
 * Route guard for the admin area: everything {@link requireSubject} requires, plus the
 * `admin` role. A signed-in subject without it is sent to their own account rather
 * than to the sign-in page, since signing in again would not help them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { redirect } from "@pkg/http/response";

import requireSubject from "~/app/http/middleware/require-subject";
import routes from "~/routes/web";

/**
 * Requires a signed-in subject holding the `admin` role.
 *
 * Runs `requireSubject` itself rather than assuming it ran earlier, so a controller
 * cannot mount the admin guard without the session guard behind it.
 */
export const requireAdmin: Middleware = (ctx, next) => {
	/** The role check, run once `requireSubject` has resolved the subject. */
	return requireSubject(ctx, async () => {
		if (ctx.subject.role !== "admin") {
			ctx.logger.info("auth_admin_required", { subjectId: ctx.subject.id });
			return redirect(routes.account.sessions.index.href(), { status: redirect.Status.SeeOther });
		}

		return await next();
	});
};

export default requireAdmin;
