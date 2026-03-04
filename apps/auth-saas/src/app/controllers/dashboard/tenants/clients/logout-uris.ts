import { html as htmlResponse } from "@pkg/http/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import { html } from "remix/html-template";

import { layout } from "~/app/lib/html";
import action from "~/lib/action";

let CreateLogoutUriSchema = s.object({
	uri: s.string(),
	type: s.enum_(["post_logout", "backchannel", "frontchannel"]),
	environment: s.optional(s.string()),
});

export default {
	new: action<"GET", "/dashboard/tenants/:tenantId/clients/:clientId/logout-uris/new">(
		async ({ params, tenant, tenantApi, logger }) => {
			let log = logger.loader(
				`/dashboard/tenants/${tenant.id}/clients/${params.clientId}/logout-uris/new`,
			);

			let client = await tenantApi.getClient(params.clientId);
			if (!client) {
				return new Response("Client not found", { status: 404 });
			}

			log.info("New logout URI form loaded", { tenantId: tenant.id, clientId: params.clientId });

			return htmlResponse(
				String(
					layout({
						title: `New Logout URI - ${client.name}`,
						tenant,
						backLink: `/dashboard/tenants/${tenant.id}/clients/${params.clientId}`,
						backText: client.name,
						content: html`
						<h2 class="text-2xl font-bold mb-6">Add Logout URI</h2>

						<form method="POST" action="/dashboard/tenants/${tenant.id}/clients/${params.clientId}/logout-uris" class="bg-white rounded-lg border p-6 space-y-4 max-w-lg">
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1" for="uri">Logout URI</label>
								<input type="url" id="uri" name="uri" required class="w-full border rounded-lg px-3 py-2" placeholder="https://myapp.com/logout">
								<p class="text-gray-500 text-xs mt-1">The URL where users will be redirected after logout</p>
							</div>

							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1" for="type">Type</label>
								<select id="type" name="type" required class="w-full border rounded-lg px-3 py-2">
									<option value="post_logout">Post-Logout Redirect</option>
									<option value="backchannel">Back-Channel Logout</option>
									<option value="frontchannel">Front-Channel Logout</option>
								</select>
								<p class="text-gray-500 text-xs mt-1">
									Post-logout: Browser redirect after logout<br>
									Back-channel: Server-to-server logout notification<br>
									Front-channel: Hidden iframe logout notification
								</p>
							</div>

							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1" for="environment">Environment (optional)</label>
								<select id="environment" name="environment" class="w-full border rounded-lg px-3 py-2">
									<option value="">Any</option>
									<option value="development">Development</option>
									<option value="staging">Staging</option>
									<option value="production">Production</option>
								</select>
							</div>

							<button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
								Add Logout URI
							</button>
						</form>
					`,
					}),
				),
			);
		},
	),

	create: action<"POST", "/dashboard/tenants/:tenantId/clients/:clientId/logout-uris">(
		async ({ formData, params, tenant, tenantApi, logger }) => {
			let log = logger.action(
				`/dashboard/tenants/${tenant.id}/clients/${params.clientId}/logout-uris`,
			);

			let body = Object.fromEntries(formData);

			let result = await validate(body, CreateLogoutUriSchema);
			if (isFailure(result)) {
				log.info("Logout URI validation failed", { issues: result.error.issues.length });
				return new Response("Validation error", { status: 400 });
			}

			await tenantApi.createLogoutUri(params.clientId, {
				uri: result.data.uri,
				type: result.data.type,
				environment: result.data.environment,
			});

			log.info("Logout URI created", { tenantId: tenant.id, clientId: params.clientId });

			return new Response(null, {
				status: 302,
				headers: { Location: `/dashboard/tenants/${tenant.id}/clients/${params.clientId}` },
			});
		},
	),

	edit: action<"GET", "/dashboard/tenants/:tenantId/clients/:clientId/logout-uris/:id/edit">(
		async ({ params, tenant, logger }) => {
			let log = logger.loader(
				`/dashboard/tenants/${tenant.id}/clients/${params.clientId}/logout-uris/${params.id}/edit`,
			);
			log.info("Logout URI edit not supported - delete and recreate");

			return new Response(null, {
				status: 302,
				headers: { Location: `/dashboard/tenants/${tenant.id}/clients/${params.clientId}` },
			});
		},
	),

	update: action<"PUT", "/dashboard/tenants/:tenantId/clients/:clientId/logout-uris/:id">(
		async ({ params, tenant, logger }) => {
			let log = logger.action(
				`/dashboard/tenants/${tenant.id}/clients/${params.clientId}/logout-uris/${params.id}`,
			);
			log.info("Logout URI update not supported");

			return new Response(null, {
				status: 302,
				headers: { Location: `/dashboard/tenants/${tenant.id}/clients/${params.clientId}` },
			});
		},
	),

	destroy: action<"DELETE", "/dashboard/tenants/:tenantId/clients/:clientId/logout-uris/:id">(
		async ({ params, tenant, tenantApi, logger }) => {
			let log = logger.action(
				`/dashboard/tenants/${tenant.id}/clients/${params.clientId}/logout-uris/${params.id}`,
			);

			await tenantApi.deleteLogoutUri(params.clientId, params.id);

			log.info("Logout URI deleted", {
				tenantId: tenant.id,
				clientId: params.clientId,
				uriId: params.id,
			});

			return new Response(null, {
				status: 302,
				headers: { Location: `/dashboard/tenants/${tenant.id}/clients/${params.clientId}` },
			});
		},
	),
};
