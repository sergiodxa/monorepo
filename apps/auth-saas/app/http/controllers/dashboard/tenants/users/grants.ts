/**
 * Dashboard controller for revoking a tenant user's OAuth grant (an authorization a
 * user previously gave to a client). Backs the "revoke grant" action on the user
 * detail page and proxies the deletion to the tenant API.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import routes from "~/routes/web";

export default {
	/**
	 * Revokes the given grant for a tenant user, then redirects back to that user's
	 * detail page.
	 *
	 * @returns A `302` redirect to the user detail page after revoking the grant.
	 * @example
	 * router.map(routes.dashboard.tenants.users.grants.destroy, grants.destroy);
	 */
	destroy: createAction(
		routes.dashboard.tenants.users.grants.destroy,
		async ({ params, tenant, tenantApi, logger }) => {
			let log = logger.action(
				`/dashboard/tenants/${tenant.id}/users/${params.userId}/grants/${params.id}`,
			);

			await tenantApi.deleteGrant(params.userId, params.id);

			log.info("Grant revoked", {
				tenantId: tenant.id,
				userId: params.userId,
				grantId: params.id,
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
