/**
 * Dashboard controller for revoking a tenant user's active session. Backs the
 * "revoke session" action on the user detail page and proxies the deletion to the
 * tenant API.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/fetch-router";

import routes from "~/routes/web";

export default {
	/**
	 * Revokes the given session for a tenant user, then redirects back to that user's
	 * detail page.
	 *
	 * @returns A `302` redirect to the user detail page after revoking the session.
	 * @example
	 * router.map(routes.dashboard.tenants.users.sessions.destroy, sessions.destroy);
	 */
	destroy: createAction(
		routes.dashboard.tenants.users.sessions.destroy,
		async ({ params, tenant, tenantApi, logger }) => {
			let log = logger.action(
				`/dashboard/tenants/${tenant.id}/users/${params.userId}/sessions/${params.id}`,
			);

			await tenantApi.deleteUserSession(params.userId, params.id);

			log.info("Session revoked", {
				tenantId: tenant.id,
				userId: params.userId,
				sessionId: params.id,
			});

			return new Response(null, {
				status: 302,
				headers: {
					Location: routes.dashboard.tenants.users.show.href({
						tenantId: tenant.id,
						id: params.userId,
					}),
				},
			});
		},
	),
};
