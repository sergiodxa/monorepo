/**
 * Route guard factory restricting a request to team admins and the team owner. Must
 * run after `requireTeam`, which resolves `ctx.team` and `ctx.membership`. Exists to
 * gate mutating team-admin routes (invites, member management, API keys, settings,
 * domains, team deletion) without duplicating the ownership/role check everywhere.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/fetch-router";

import { forbidden } from "@pkg/http/response/html";

/**
 * Requires the current viewer to be the team owner or hold one of `roles`.
 *
 * @param roles Membership roles allowed in addition to the team owner.
 * @returns Middleware responding 403 when the viewer is neither the owner nor holds
 * one of `roles`.
 * @example
 * router.map(routes.actions.monitor.http.delete, {
 * 	middleware: [requireUser, requireTeam, requireRole("admin")],
 * 	handler,
 * });
 */
export default function requireRole(...roles: Array<"admin" | "member">): Middleware {
	return (ctx, next) => {
		let isOwner = ctx.team.owner_id === ctx.membership.subject_id;
		let hasRole = roles.includes(ctx.membership.role);
		if (!isOwner && !hasRole)
			return forbidden("You do not have permission to perform this action.");
		return next();
	};
}
