import routes from "~/app/routes";
import action from "~/lib/action";

export default {
	destroy: action<"DELETE", "/dashboard/tenants/:tenantId/users/:userId/sessions/:id">(
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
