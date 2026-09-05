/**
 * Dashboard controller for deleting a tenant user's passkey (WebAuthn credential).
 * Backs the "delete passkey" action on the user detail page and proxies the deletion
 * to the tenant API.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import routes from "~/routes/web";

export default {
	/**
	 * Deletes the given passkey for a tenant user, then redirects back to that user's
	 * detail page.
	 *
	 * @returns A `302` redirect to the user detail page after deleting the passkey.
	 * @example
	 * router.map(routes.dashboard.tenants.users.passkeys.destroy, passkeys.destroy);
	 */
	destroy: createAction(
		routes.dashboard.tenants.users.passkeys.destroy,
		async ({ params, tenant, tenantApi, log }) => {
			await tenantApi.deletePasskey(params.userId, params.id);

			log
				.set({ tenant_user: { id: params.userId }, passkey: { id: params.id } })
				.note("tenant_user.passkey_deleted");

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
