import { html as htmlResponse } from "@pkg/http/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import { html } from "remix/html-template";

import { layout } from "~/app/lib/html";
import routes from "~/app/routes";
import action from "~/lib/action";

let CreateRedirectUriSchema = s.object({
	uri: s.string(),
	environment: s.optional(s.string()),
});

export default {
	new: action<"GET", "/dashboard/tenants/:tenantId/clients/:clientId/redirect-uris/new">(
		async ({ params, tenant, tenantApi, logger }) => {
			let log = logger.loader(
				`/dashboard/tenants/${tenant.id}/clients/${params.clientId}/redirect-uris/new`,
			);

			let client = await tenantApi.getClient(params.clientId);
			if (!client) {
				return new Response("Client not found", { status: 404 });
			}

			log.info("New redirect URI form loaded", { tenantId: tenant.id, clientId: params.clientId });

			return htmlResponse(
				String(
					layout({
						title: `New Redirect URI - ${client.name}`,
						tenant,
						backLink: routes.dashboard.tenants.clients.show.href({
							tenantId: tenant.id,
							id: params.clientId,
						}),
						backText: client.name,
						content: html`
							<h2 class="text-2xl font-bold mb-6">Add Redirect URI</h2>

							<form
								method="POST"
								action="${routes.dashboard.tenants.clients["redirect-uris"].create.href({
									tenantId: tenant.id,
									clientId: params.clientId,
								})}"
								class="bg-white rounded-lg border p-6 space-y-4 max-w-lg"
							>
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1" for="uri"
										>Redirect URI</label
									>
									<input
										type="url"
										id="uri"
										name="uri"
										required
										class="w-full border rounded-lg px-3 py-2"
										placeholder="https://myapp.com/callback"
									/>
									<p class="text-gray-500 text-xs mt-1">
										The URL where users will be redirected after authentication
									</p>
								</div>

								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1" for="environment"
										>Environment (optional)</label
									>
									<select
										id="environment"
										name="environment"
										class="w-full border rounded-lg px-3 py-2"
									>
										<option value="">Any</option>
										<option value="development">Development</option>
										<option value="staging">Staging</option>
										<option value="production">Production</option>
									</select>
									<p class="text-gray-500 text-xs mt-1">
										Restrict this URI to a specific environment
									</p>
								</div>

								<button
									type="submit"
									class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
								>
									Add Redirect URI
								</button>
							</form>
						`,
					}),
				),
			);
		},
	),

	create: action<"POST", "/dashboard/tenants/:tenantId/clients/:clientId/redirect-uris">(
		async ({ formData, params, tenant, tenantApi, logger }) => {
			let log = logger.action(
				`/dashboard/tenants/${tenant.id}/clients/${params.clientId}/redirect-uris`,
			);

			let body = Object.fromEntries(formData);

			let result = await validate(body, CreateRedirectUriSchema);
			if (isFailure(result)) {
				log.info("Redirect URI validation failed", { issues: result.error.issues.length });
				return new Response("Validation error", { status: 400 });
			}

			await tenantApi.createRedirectUri(params.clientId, {
				uri: result.data.uri,
				environment: result.data.environment,
			});

			log.info("Redirect URI created", { tenantId: tenant.id, clientId: params.clientId });

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

	edit: action<"GET", "/dashboard/tenants/:tenantId/clients/:clientId/redirect-uris/:id/edit">(
		async ({ params, tenant, logger }) => {
			let log = logger.loader(
				`/dashboard/tenants/${tenant.id}/clients/${params.clientId}/redirect-uris/${params.id}/edit`,
			);
			log.info("Redirect URI edit not supported - delete and recreate");

			// Redirect URIs cannot be edited, only deleted and recreated
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

	update: action<"PUT", "/dashboard/tenants/:tenantId/clients/:clientId/redirect-uris/:id">(
		async ({ params, tenant, logger }) => {
			let log = logger.action(
				`/dashboard/tenants/${tenant.id}/clients/${params.clientId}/redirect-uris/${params.id}`,
			);
			log.info("Redirect URI update not supported");

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

	destroy: action<"DELETE", "/dashboard/tenants/:tenantId/clients/:clientId/redirect-uris/:id">(
		async ({ params, tenant, tenantApi, logger }) => {
			let log = logger.action(
				`/dashboard/tenants/${tenant.id}/clients/${params.clientId}/redirect-uris/${params.id}`,
			);

			await tenantApi.deleteRedirectUri(params.clientId, params.id);

			log.info("Redirect URI deleted", {
				tenantId: tenant.id,
				clientId: params.clientId,
				uriId: params.id,
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
