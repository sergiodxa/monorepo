import { createAction } from "remix/fetch-router";

import routes from "~/routes/web";

export default {
	destroy: createAction(
		routes.dashboard.tenants.users.passkeys.destroy,
		async ({ params, tenant, tenantApi, logger }) => {
			let log = logger.action(
				`/dashboard/tenants/${tenant.id}/users/${params.userId}/passkeys/${params.id}`,
			);

			await tenantApi.deletePasskey(params.userId, params.id);

			log.info("Passkey deleted", {
				tenantId: tenant.id,
				userId: params.userId,
				passkeyId: params.id,
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
