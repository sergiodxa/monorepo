import action from "~/app/lib/action";
import routes from "~/routes/web";

export default {
	destroy: action<"DELETE", "/dashboard/tenants/:tenantId/users/:userId/grants/:id">(
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
