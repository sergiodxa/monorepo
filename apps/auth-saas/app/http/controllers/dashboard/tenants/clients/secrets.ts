import { html as htmlResponse } from "@pkg/http/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import { createAction } from "remix/fetch-router";
import { html } from "remix/html-template";

import { layout } from "~/resources/layouts/document";
import routes from "~/routes/web";

let CreateSecretSchema = s.object({
	name: s.optional(s.string()),
	expiresAt: s.optional(s.string()),
});

export default {
	new: createAction(
		routes.dashboard.tenants.clients.secrets.new,
		async ({ params, tenant, tenantApi, logger }) => {
			let log = logger.loader(
				`/dashboard/tenants/${tenant.id}/clients/${params.clientId}/secrets/new`,
			);

			let client = await tenantApi.getClient(params.clientId);
			if (!client) {
				return new Response("Client not found", { status: 404 });
			}

			log.info("New secret form loaded", { tenantId: tenant.id, clientId: params.clientId });

			return htmlResponse(
				String(
					layout({
						title: `New Secret - ${client.name}`,
						tenant,
						backLink: routes.dashboard.tenants.clients.show.href({
							tenantId: tenant.id,
							id: params.clientId,
						}),
						backText: client.name,
						content: html`
							<h2 class="text-2xl font-bold mb-6">Generate New Secret</h2>

							<form
								method="POST"
								action="${routes.dashboard.tenants.clients.secrets.create.href({
									tenantId: tenant.id,
									clientId: params.clientId,
								})}"
								class="bg-white rounded-lg border p-6 space-y-4 max-w-lg"
							>
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1" for="name"
										>Name (optional)</label
									>
									<input
										type="text"
										id="name"
										name="name"
										class="w-full border rounded-lg px-3 py-2"
										placeholder="Production server"
									/>
									<p class="text-gray-500 text-xs mt-1">A label to help you identify this secret</p>
								</div>

								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1" for="expiresAt"
										>Expiration (optional)</label
									>
									<input
										type="date"
										id="expiresAt"
										name="expiresAt"
										class="w-full border rounded-lg px-3 py-2"
									/>
									<p class="text-gray-500 text-xs mt-1">Leave empty for no expiration</p>
								</div>

								<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
									<p class="text-yellow-800 text-sm">
										<strong>Important:</strong> The secret will only be shown once after creation.
										Make sure to copy it immediately.
									</p>
								</div>

								<button
									type="submit"
									class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
								>
									Generate Secret
								</button>
							</form>
						`,
					}),
				),
			);
		},
	),

	create: createAction(
		routes.dashboard.tenants.clients.secrets.create,
		async ({ formData, params, tenant, tenantApi, logger }) => {
			let log = logger.action(`/dashboard/tenants/${tenant.id}/clients/${params.clientId}/secrets`);

			let client = await tenantApi.getClient(params.clientId);
			if (!client) {
				return new Response("Client not found", { status: 404 });
			}

			let body = Object.fromEntries(formData);

			let result = await validate(body, CreateSecretSchema);
			if (isFailure(result)) {
				log.info("Secret creation validation failed", { issues: result.error.issues.length });
				return new Response("Validation error", { status: 400 });
			}

			let { id, secret } = await tenantApi.createSecret(params.clientId, {
				name: result.data.name,
				expiresAt: result.data.expiresAt,
			});

			log.info("Secret created", { tenantId: tenant.id, clientId: params.clientId, secretId: id });

			// Show the secret once - user must copy it
			return htmlResponse(
				String(
					layout({
						title: `Secret Created - ${client.name}`,
						tenant,
						content: html`
							<h2 class="text-2xl font-bold mb-6">Secret Created</h2>

							<div class="bg-green-50 border border-green-200 rounded-lg p-6 mb-6 max-w-lg">
								<p class="text-green-800 font-medium mb-4">
									Your client secret has been generated:
								</p>
								<div class="bg-white border rounded-lg p-4 font-mono text-sm break-all select-all">
									${secret}
								</div>
								<p class="text-green-700 text-sm mt-4">
									<strong>Copy this secret now!</strong> It will not be shown again.
								</p>
							</div>

							<a
								href="${routes.dashboard.tenants.clients.show.href({
									tenantId: tenant.id,
									id: params.clientId,
								})}"
								class="text-blue-600 hover:text-blue-800"
							>
								&larr; Back to ${client.name}
							</a>
						`,
					}),
				),
			);
		},
	),

	edit: createAction(
		routes.dashboard.tenants.clients.secrets.edit,
		async ({ params, tenant, logger }) => {
			let log = logger.loader(
				`/dashboard/tenants/${tenant.id}/clients/${params.clientId}/secrets/${params.id}/edit`,
			);
			log.info("Secret edit not supported - secrets cannot be edited");

			// Secrets cannot be edited, only revoked
			return new Response(null, {
				status: 302,
				headers: {
					Location: routes.dashboard.tenants.clients.show.href({
						tenantId: tenant.id,
						id: params.clientId,
					}),
				},
			});
		},
	),

	update: createAction(
		routes.dashboard.tenants.clients.secrets.update,
		async ({ params, tenant, logger }) => {
			let log = logger.action(
				`/dashboard/tenants/${tenant.id}/clients/${params.clientId}/secrets/${params.id}`,
			);
			log.info("Secret update not supported - secrets cannot be edited");

			// Secrets cannot be updated
			return new Response(null, {
				status: 302,
				headers: {
					Location: routes.dashboard.tenants.clients.show.href({
						tenantId: tenant.id,
						id: params.clientId,
					}),
				},
			});
		},
	),

	destroy: createAction(
		routes.dashboard.tenants.clients.secrets.destroy,
		async ({ params, tenant, tenantApi, logger }) => {
			let log = logger.action(
				`/dashboard/tenants/${tenant.id}/clients/${params.clientId}/secrets/${params.id}`,
			);

			await tenantApi.deleteSecret(params.clientId, params.id);

			log.info("Secret revoked", {
				tenantId: tenant.id,
				clientId: params.clientId,
				secretId: params.id,
			});

			return new Response(null, {
				status: 302,
				headers: {
					Location: routes.dashboard.tenants.clients.show.href({
						tenantId: tenant.id,
						id: params.clientId,
					}),
				},
			});
		},
	),
};
