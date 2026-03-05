import action from "~/lib/action";

export default {
	destroy: action<"DELETE", "/dashboard/tenants/:tenantId/users/:userId/passkeys/:id">(
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
				headers: { Location: `/dashboard/tenants/${tenant.id}/users/${params.userId}` },
			});
		},
	),
};
