/**
 * Binds the signed-in subject as `ctx.access`, the principal every authorization check
 * in the account and admin areas answers for. It reads `ctx.subject`, so it runs after
 * `requireSubject`: authentication decides who is asking, this decides what they may do.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Refusal } from "@sdxc/authz";
import type { Middleware, RequestContext } from "remix/router";

import { access, requireAbility } from "@sdxc/authz/middleware/router";
import { redirect } from "@sdxc/http/response";

import abilities from "~/app/authz/abilities";
import policy from "~/app/authz/policy";
import defaultHandler from "~/app/http/controllers/default-handler";
import routes from "~/routes/web";

/**
 * Answers a refusal `requireAbility` reaches. A `notFound` refusal renders the same 404
 * page an unknown URL gets, so a hidden record and a missing one look alike; any other
 * sends the subject to their own account, the one area every subject may open.
 */
export function answerRefusal(
	ctx: RequestContext,
	decision: Refusal,
): Response | Promise<Response> {
	if (decision.as === "notFound") return defaultHandler(ctx);
	return redirect(routes.account.sessions.index.href(), { status: redirect.Status.SeeOther });
}

/**
 * The subject's access, binding the role and id from `ctx.subject` and loading the whole
 * catalog up front, so a handler or view checks synchronously.
 */
export const subjectAccess: Middleware = access(policy, {
	roles: (ctx) => [ctx.subject.role],
	facts: { actor: (ctx) => ({ id: ctx.subject.id }) },
	load: [abilities],
	onDenied: answerRefusal,
});

/**
 * Opens the admin area to a subject holding `admin.access`, sending anyone else to their
 * own account. Installed after `subjectAccess`, on every admin controller.
 */
export const requireAdminArea: Middleware = requireAbility(abilities.admin.access);

export default subjectAccess;
