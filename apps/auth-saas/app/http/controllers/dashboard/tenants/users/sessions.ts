import { createAction } from "remix/fetch-router";

import routes from "~/routes/web";

export default {
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
