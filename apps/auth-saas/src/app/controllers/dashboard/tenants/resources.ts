import { html as htmlResponse } from "@pkg/http/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import { html } from "remix/html-template";

import { layout } from "~/app/lib/html";
import action from "~/lib/action";

let CreateResourceSchema = s.object({
	identifier: s.string(),
	name: s.string(),
	description: s.optional(s.string()),
});

let UpdateResourceSchema = s.object({
	identifier: s.optional(s.string()),
	name: s.optional(s.string()),
	description: s.optional(s.nullable(s.string())),
});

export default {
	index: action<"GET", "/dashboard/tenants/:tenantId/resources">(
		async ({ tenant, tenantApi, logger }) => {
			let log = logger.loader(`/dashboard/tenants/${tenant.id}/resources`);

			let resources = await tenantApi.listResources();

			log.info("Resources listed", { tenantId: tenant.id, count: resources.length });

			let resourcesHtml =
				resources.length === 0
					? html`
							<p class="text-gray-500">No resources yet. Create your first API resource to get started.</p>
						`
					: html`<ul class="space-y-4">${resources.map(
							(r) => html`
					<li class="border rounded-lg p-4 hover:bg-gray-50">
						<a href="/dashboard/tenants/${tenant.id}/resources/${r.id}" class="block">
							<div class="flex justify-between items-start">
								<div>
									<h3 class="font-semibold">${r.name}</h3>
									<code class="text-sm text-gray-500">${r.identifier}</code>
									<p class="text-gray-500 text-sm mt-1">${r.description ?? "No description"}</p>
								</div>
								<span class="text-sm text-gray-500">${r.scopes.length} scopes</span>
							</div>
						</a>
					</li>
				`,
						)}</ul>`;

			return htmlResponse(
				String(
					layout({
						title: `Resources - ${tenant.name}`,
						tenant,
						content: html`
						<div class="flex justify-between items-center mb-6">
							<h2 class="text-2xl font-bold">API Resources</h2>
							<a href="/dashboard/tenants/${tenant.id}/resources/new" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
								New Resource
							</a>
						</div>
						${resourcesHtml}
					`,
					}),
				),
			);
		},
	),

	show: action<"GET", "/dashboard/tenants/:tenantId/resources/:id">(
		async ({ params, tenant, tenantApi, logger }) => {
			let log = logger.loader(`/dashboard/tenants/${tenant.id}/resources/${params.id}`);

			let resource = await tenantApi.getResource(params.id);
			if (!resource) {
				return new Response("Resource not found", { status: 404 });
			}

			log.info("Resource retrieved", { tenantId: tenant.id, resourceId: params.id });

			let scopesList =
				resource.scopes.length === 0
					? html`
							<p class="text-gray-500 text-sm">No scopes defined</p>
						`
					: html`<ul class="space-y-2">${resource.scopes.map(
							(s, i) => html`
											<li class="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0">
												<div>
													<code class="font-medium">${s.name}</code>
													<p class="text-gray-500 text-sm">${s.description ?? "No description"}</p>
												</div>
												<form method="POST" action="/dashboard/tenants/${tenant.id}/resources/${params.id}/scopes/${i}" class="inline">
													<input type="hidden" name="_method" value="DELETE">
													<button type="submit" class="text-red-600 hover:text-red-800 text-sm" onclick="return confirm('Remove this scope?')">Remove</button>
												</form>
											</li>
										`,
						)}</ul>`;

			return htmlResponse(
				String(
					layout({
						title: `${resource.name} - ${tenant.name}`,
						tenant,
						backLink: `/dashboard/tenants/${tenant.id}/resources`,
						backText: "Resources",
						content: html`
						<div class="flex justify-between items-start mb-6">
							<div>
								<h2 class="text-2xl font-bold">${resource.name}</h2>
								<code class="text-gray-500">${resource.identifier}</code>
								<p class="text-gray-500 mt-1">${resource.description ?? "No description"}</p>
							</div>
							<div class="flex gap-2">
								<a href="/dashboard/tenants/${tenant.id}/resources/${params.id}/edit" class="text-blue-600 hover:text-blue-800">Edit</a>
								<form method="POST" action="/dashboard/tenants/${tenant.id}/resources/${params.id}" class="inline">
									<input type="hidden" name="_method" value="DELETE">
									<button type="submit" class="text-red-600 hover:text-red-800" onclick="return confirm('Delete this resource?')">Delete</button>
								</form>
							</div>
						</div>

						<section class="bg-white rounded-lg border p-4">
							<div class="flex justify-between items-center mb-4">
								<h3 class="font-semibold">Scopes</h3>
								<a href="/dashboard/tenants/${tenant.id}/resources/${params.id}/scopes/new" class="text-blue-600 hover:text-blue-800 text-sm">Add Scope</a>
							</div>
							${scopesList}
						</section>
					`,
					}),
				),
			);
		},
	),

	new: action<"GET", "/dashboard/tenants/:tenantId/resources/new">(({ tenant, logger }) => {
		let log = logger.loader(`/dashboard/tenants/${tenant.id}/resources/new`);
		log.info("New resource form loaded", { tenantId: tenant.id });

		return htmlResponse(
			String(
				layout({
					title: `New Resource - ${tenant.name}`,
					tenant,
					backLink: `/dashboard/tenants/${tenant.id}/resources`,
					backText: "Resources",
					content: html`
					<h2 class="text-2xl font-bold mb-6">New API Resource</h2>

					<form method="POST" action="/dashboard/tenants/${tenant.id}/resources" class="bg-white rounded-lg border p-6 space-y-4 max-w-lg">
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1" for="identifier">Identifier (Audience)</label>
							<input type="text" id="identifier" name="identifier" required class="w-full border rounded-lg px-3 py-2" placeholder="https://api.example.com">
							<p class="text-gray-500 text-xs mt-1">Usually a URL that identifies your API</p>
						</div>

						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1" for="name">Name</label>
							<input type="text" id="name" name="name" required class="w-full border rounded-lg px-3 py-2" placeholder="My API">
						</div>

						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1" for="description">Description</label>
							<textarea id="description" name="description" rows="2" class="w-full border rounded-lg px-3 py-2" placeholder="Optional description"></textarea>
						</div>

						<button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
							Create Resource
						</button>
					</form>
				`,
				}),
			),
		);
	}),

	create: action<"POST", "/dashboard/tenants/:tenantId/resources">(
		async ({ formData, tenant, tenantApi, logger }) => {
			let log = logger.action(`/dashboard/tenants/${tenant.id}/resources`);

			let body = Object.fromEntries(formData);

			let result = await validate(body, CreateResourceSchema);
			if (isFailure(result)) {
				log.info("Resource creation validation failed", { issues: result.error.issues.length });
				return new Response("Validation error", { status: 400 });
			}

			let { id } = await tenantApi.createResource({
				identifier: result.data.identifier,
				name: result.data.name,
				description: result.data.description,
				scopes: [],
			});

			log.info("Resource created", { tenantId: tenant.id, resourceId: id });

			return new Response(null, {
				status: 302,
				headers: { Location: `/dashboard/tenants/${tenant.id}/resources/${id}` },
			});
		},
	),

	edit: action<"GET", "/dashboard/tenants/:tenantId/resources/:id/edit">(
		async ({ params, tenant, tenantApi, logger }) => {
			let log = logger.loader(`/dashboard/tenants/${tenant.id}/resources/${params.id}/edit`);

			let resource = await tenantApi.getResource(params.id);
			if (!resource) {
				return new Response("Resource not found", { status: 404 });
			}

			log.info("Resource edit form loaded", { tenantId: tenant.id, resourceId: params.id });

			return htmlResponse(
				String(
					layout({
						title: `Edit ${resource.name} - ${tenant.name}`,
						tenant,
						backLink: `/dashboard/tenants/${tenant.id}/resources/${params.id}`,
						backText: resource.name,
						content: html`
						<h2 class="text-2xl font-bold mb-6">Edit Resource</h2>

						<form method="POST" action="/dashboard/tenants/${tenant.id}/resources/${params.id}" class="bg-white rounded-lg border p-6 space-y-4 max-w-lg">
							<input type="hidden" name="_method" value="PUT">
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1" for="identifier">Identifier (Audience)</label>
								<input type="text" id="identifier" name="identifier" value="${resource.identifier}" required class="w-full border rounded-lg px-3 py-2">
							</div>

							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1" for="name">Name</label>
								<input type="text" id="name" name="name" value="${resource.name}" required class="w-full border rounded-lg px-3 py-2">
							</div>

							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1" for="description">Description</label>
								<textarea id="description" name="description" rows="2" class="w-full border rounded-lg px-3 py-2">${resource.description ?? ""}</textarea>
							</div>

							<button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
								Save Changes
							</button>
						</form>
					`,
					}),
				),
			);
		},
	),

	update: action<"PUT", "/dashboard/tenants/:tenantId/resources/:id">(
		async ({ formData, params, tenant, tenantApi, logger }) => {
			let log = logger.action(`/dashboard/tenants/${tenant.id}/resources/${params.id}`);

			let body = Object.fromEntries(formData);

			let result = await validate(body, UpdateResourceSchema);
			if (isFailure(result)) {
				log.info("Resource update validation failed", { issues: result.error.issues.length });
				return new Response("Validation error", { status: 400 });
			}

			await tenantApi.updateResource(params.id, {
				identifier: result.data.identifier,
				name: result.data.name,
				description: result.data.description,
			});

			log.info("Resource updated", { tenantId: tenant.id, resourceId: params.id });

			return new Response(null, {
				status: 302,
				headers: { Location: `/dashboard/tenants/${tenant.id}/resources/${params.id}` },
			});
		},
	),

	destroy: action<"DELETE", "/dashboard/tenants/:tenantId/resources/:id">(
		async ({ params, tenant, tenantApi, logger }) => {
			let log = logger.action(`/dashboard/tenants/${tenant.id}/resources/${params.id}`);

			await tenantApi.deleteResource(params.id);

			log.info("Resource deleted", { tenantId: tenant.id, resourceId: params.id });

			return new Response(null, {
				status: 302,
				headers: { Location: `/dashboard/tenants/${tenant.id}/resources` },
			});
		},
	),
};
