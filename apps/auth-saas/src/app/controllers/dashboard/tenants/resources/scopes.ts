import { html as htmlResponse } from "@pkg/http/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import { html } from "remix/html-template";

import { layout } from "~/app/lib/html";
import routes from "~/app/routes";
import action from "~/lib/action";

let CreateScopeSchema = s.object({
	name: s.string(),
	description: s.optional(s.string()),
});

export default {
	new: action<"GET", "/dashboard/tenants/:tenantId/resources/:resourceId/scopes/new">(
		async ({ params, tenant, tenantApi, logger }) => {
			let log = logger.loader(
				`/dashboard/tenants/${tenant.id}/resources/${params.resourceId}/scopes/new`,
			);

			let resource = await tenantApi.getResource(params.resourceId);
			if (!resource) {
				return new Response("Resource not found", { status: 404 });
			}

			log.info("New scope form loaded", { tenantId: tenant.id, resourceId: params.resourceId });

			return htmlResponse(
				String(
					layout({
						title: `New Scope - ${resource.name}`,
						tenant,
						backLink: routes.dashboard.tenants.resources.show.href({ tenantId: tenant.id, id: params.resourceId }),
						backText: resource.name,
						content: html`
						<h2 class="text-2xl font-bold mb-6">Add Scope</h2>

						<form method="POST" action="${routes.dashboard.tenants.resources.scopes.create.href({ tenantId: tenant.id, resourceId: params.resourceId })}" class="bg-white rounded-lg border p-6 space-y-4 max-w-lg">
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1" for="name">Scope Name</label>
								<input type="text" id="name" name="name" required class="w-full border rounded-lg px-3 py-2" placeholder="read:users">
								<p class="text-gray-500 text-xs mt-1">Use lowercase with colons for namespacing (e.g., read:users, write:posts)</p>
							</div>

							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1" for="description">Description</label>
								<textarea id="description" name="description" rows="2" class="w-full border rounded-lg px-3 py-2" placeholder="Read user profile information"></textarea>
								<p class="text-gray-500 text-xs mt-1">Shown to users during consent</p>
							</div>

							<button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
								Add Scope
							</button>
						</form>
					`,
					}),
				),
			);
		},
	),

	create: action<"POST", "/dashboard/tenants/:tenantId/resources/:resourceId/scopes">(
		async ({ formData, params, tenant, tenantApi, logger }) => {
			let log = logger.action(
				`/dashboard/tenants/${tenant.id}/resources/${params.resourceId}/scopes`,
			);

			let resource = await tenantApi.getResource(params.resourceId);
			if (!resource) {
				return new Response("Resource not found", { status: 404 });
			}

			let body = Object.fromEntries(formData);

			let result = await validate(body, CreateScopeSchema);
			if (isFailure(result)) {
				log.info("Scope validation failed", { issues: result.error.issues.length });
				return new Response("Validation error", { status: 400 });
			}

			// Add scope to existing scopes
			let newScopes = [
				...resource.scopes,
				{ name: result.data.name, description: result.data.description },
			];

			await tenantApi.updateResource(params.resourceId, {
				scopes: newScopes,
			});

			log.info("Scope added", {
				tenantId: tenant.id,
				resourceId: params.resourceId,
				scope: result.data.name,
			});

			return new Response(null, {
				status: 302,
				headers: { Location: routes.dashboard.tenants.resources.show.href({ tenantId: tenant.id, id: params.resourceId }) },
			});
		},
	),

	edit: action<"GET", "/dashboard/tenants/:tenantId/resources/:resourceId/scopes/:id/edit">(
		async ({ params, tenant, logger }) => {
			let log = logger.loader(
				`/dashboard/tenants/${tenant.id}/resources/${params.resourceId}/scopes/${params.id}/edit`,
			);
			log.info("Scope edit not supported - delete and recreate");

			return new Response(null, {
				status: 302,
				headers: { Location: routes.dashboard.tenants.resources.show.href({ tenantId: tenant.id, id: params.resourceId }) },
			});
		},
	),

	update: action<"PUT", "/dashboard/tenants/:tenantId/resources/:resourceId/scopes/:id">(
		async ({ params, tenant, logger }) => {
			let log = logger.action(
				`/dashboard/tenants/${tenant.id}/resources/${params.resourceId}/scopes/${params.id}`,
			);
			log.info("Scope update not supported");

			return new Response(null, {
				status: 302,
				headers: { Location: routes.dashboard.tenants.resources.show.href({ tenantId: tenant.id, id: params.resourceId }) },
			});
		},
	),

	destroy: action<"DELETE", "/dashboard/tenants/:tenantId/resources/:resourceId/scopes/:id">(
		async ({ params, tenant, tenantApi, logger }) => {
			let log = logger.action(
				`/dashboard/tenants/${tenant.id}/resources/${params.resourceId}/scopes/${params.id}`,
			);

			let resource = await tenantApi.getResource(params.resourceId);
			if (!resource) {
				return new Response("Resource not found", { status: 404 });
			}

			// Remove scope by index (id is the index in this case)
			let scopeIndex = parseInt(params.id, 10);
			let newScopes = resource.scopes.filter((_, i) => i !== scopeIndex);

			await tenantApi.updateResource(params.resourceId, {
				scopes: newScopes,
			});

			log.info("Scope removed", {
				tenantId: tenant.id,
				resourceId: params.resourceId,
				scopeIndex: params.id,
			});

		return new Response(null, {
			status: 302,
			headers: { Location: routes.dashboard.tenants.resources.show.href({ tenantId: tenant.id, id: params.resourceId }) },
		});
	},
),
};
