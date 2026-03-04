import { html as htmlResponse } from "@pkg/http/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import { html } from "remix/html-template";

import { layout } from "~/app/lib/html";
import action from "~/lib/action";

let CreateClientSchema = s.object({
	name: s.string(),
	type: s.enum_(["public", "confidential", "m2m"]),
	description: s.optional(s.string()),
});

let UpdateClientSchema = s.object({
	name: s.optional(s.string()),
	description: s.optional(s.nullable(s.string())),
	type: s.optional(s.enum_(["public", "confidential", "m2m"])),
});

export default {
	index: action<"GET", "/dashboard/tenants/:tenantId/clients">(
		async ({ tenant, tenantApi, logger }) => {
			let log = logger.loader(`/dashboard/tenants/${tenant.id}/clients`);

			let clients = await tenantApi.listClients();

			log.info("Clients listed", { tenantId: tenant.id, count: clients.length });

			let clientsHtml =
				clients.length === 0
					? html`
							<p class="text-gray-500">No clients yet. Create your first client to get started.</p>
						`
					: html`<ul class="space-y-4">${clients.map(
							(c) => html`
					<li class="border rounded-lg p-4 hover:bg-gray-50">
						<a href="/dashboard/tenants/${tenant.id}/clients/${c.id}" class="block">
							<div class="flex justify-between items-start">
								<div>
									<h3 class="font-semibold">${c.name}</h3>
									<p class="text-gray-500 text-sm">${c.description ?? "No description"}</p>
								</div>
								<span class="px-2 py-1 text-xs rounded ${c.type === "public" ? "bg-blue-100 text-blue-800" : c.type === "confidential" ? "bg-purple-100 text-purple-800" : "bg-orange-100 text-orange-800"}">
									${c.type}
								</span>
							</div>
						</a>
					</li>
				`,
						)}</ul>`;

			return htmlResponse(
				String(
					layout({
						title: `Clients - ${tenant.name}`,
						tenant,
						content: html`
						<div class="flex justify-between items-center mb-6">
							<h2 class="text-2xl font-bold">Clients</h2>
							<a href="/dashboard/tenants/${tenant.id}/clients/new" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
								New Client
							</a>
						</div>
						${clientsHtml}
					`,
					}),
				),
			);
		},
	),

	show: action<"GET", "/dashboard/tenants/:tenantId/clients/:id">(
		async ({ params, tenant, tenantApi, logger }) => {
			let log = logger.loader(`/dashboard/tenants/${tenant.id}/clients/${params.id}`);

			let client = await tenantApi.getClient(params.id);
			if (!client) {
				return new Response("Client not found", { status: 404 });
			}

			let [secrets, redirectUris, logoutUris] = await Promise.all([
				tenantApi.listSecrets(params.id),
				tenantApi.listRedirectUris(params.id),
				tenantApi.listLogoutUris(params.id),
			]);

			log.info("Client retrieved", { tenantId: tenant.id, clientId: params.id });

			let secretsList =
				secrets.length === 0
					? html`
							<p class="text-gray-500 text-sm">No secrets configured</p>
						`
					: html`<ul class="space-y-2">${secrets.map(
							(s) => html`
												<li class="flex justify-between items-center text-sm">
													<span>${s.name || "Unnamed secret"}</span>
													<form method="POST" action="/dashboard/tenants/${tenant.id}/clients/${params.id}/secrets/${s.id}?_method=DELETE" class="inline">
														<button type="submit" class="text-red-600 hover:text-red-800" onclick="return confirm('Revoke this secret?')">Revoke</button>
													</form>
												</li>
											`,
						)}</ul>`;

			let redirectUrisList =
				redirectUris.length === 0
					? html`
							<p class="text-gray-500 text-sm">No redirect URIs configured</p>
						`
					: html`<ul class="space-y-2">${redirectUris.map(
							(u) => html`
												<li class="flex justify-between items-center text-sm">
													<code class="bg-gray-100 px-2 py-1 rounded">${u.uri}</code>
													<form method="POST" action="/dashboard/tenants/${tenant.id}/clients/${params.id}/redirect-uris/${u.id}?_method=DELETE" class="inline">
														<button type="submit" class="text-red-600 hover:text-red-800" onclick="return confirm('Remove this URI?')">Remove</button>
													</form>
												</li>
											`,
						)}</ul>`;

			let logoutUrisList =
				logoutUris.length === 0
					? html`
							<p class="text-gray-500 text-sm">No logout URIs configured</p>
						`
					: html`<ul class="space-y-2">${logoutUris.map(
							(u) => html`
												<li class="flex justify-between items-center text-sm">
													<div>
														<code class="bg-gray-100 px-2 py-1 rounded">${u.uri}</code>
														<span class="ml-2 text-gray-500">(${u.type})</span>
													</div>
													<form method="POST" action="/dashboard/tenants/${tenant.id}/clients/${params.id}/logout-uris/${u.id}?_method=DELETE" class="inline">
														<button type="submit" class="text-red-600 hover:text-red-800" onclick="return confirm('Remove this URI?')">Remove</button>
													</form>
												</li>
											`,
						)}</ul>`;

			return htmlResponse(
				String(
					layout({
						title: `${client.name} - ${tenant.name}`,
						tenant,
						backLink: `/dashboard/tenants/${tenant.id}/clients`,
						backText: "Clients",
						content: html`
						<div class="flex justify-between items-start mb-6">
							<div>
								<h2 class="text-2xl font-bold">${client.name}</h2>
								<p class="text-gray-500">${client.description ?? "No description"}</p>
							</div>
							<div class="flex gap-2">
								<a href="/dashboard/tenants/${tenant.id}/clients/${params.id}/edit" class="text-blue-600 hover:text-blue-800">Edit</a>
								<form method="POST" action="/dashboard/tenants/${tenant.id}/clients/${params.id}?_method=DELETE" class="inline">
									<button type="submit" class="text-red-600 hover:text-red-800" onclick="return confirm('Delete this client?')">Delete</button>
								</form>
							</div>
						</div>

						<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
							<div class="bg-white rounded-lg border p-4">
								<h3 class="font-semibold mb-2">Client ID</h3>
								<code class="text-sm bg-gray-100 px-2 py-1 rounded block break-all">${client.id}</code>
							</div>
							<div class="bg-white rounded-lg border p-4">
								<h3 class="font-semibold mb-2">Type</h3>
								<span class="px-2 py-1 text-xs rounded ${client.type === "public" ? "bg-blue-100 text-blue-800" : client.type === "confidential" ? "bg-purple-100 text-purple-800" : "bg-orange-100 text-orange-800"}">
									${client.type}
								</span>
							</div>
						</div>

						<div class="space-y-6">
							<section class="bg-white rounded-lg border p-4">
								<div class="flex justify-between items-center mb-4">
									<h3 class="font-semibold">Client Secrets</h3>
									<a href="/dashboard/tenants/${tenant.id}/clients/${params.id}/secrets/new" class="text-blue-600 hover:text-blue-800 text-sm">Add Secret</a>
								</div>
								${secretsList}
							</section>

							<section class="bg-white rounded-lg border p-4">
								<div class="flex justify-between items-center mb-4">
									<h3 class="font-semibold">Redirect URIs</h3>
									<a href="/dashboard/tenants/${tenant.id}/clients/${params.id}/redirect-uris/new" class="text-blue-600 hover:text-blue-800 text-sm">Add URI</a>
								</div>
								${redirectUrisList}
							</section>

							<section class="bg-white rounded-lg border p-4">
								<div class="flex justify-between items-center mb-4">
									<h3 class="font-semibold">Logout URIs</h3>
									<a href="/dashboard/tenants/${tenant.id}/clients/${params.id}/logout-uris/new" class="text-blue-600 hover:text-blue-800 text-sm">Add URI</a>
								</div>
								${logoutUrisList}
							</section>
						</div>
					`,
					}),
				),
			);
		},
	),

	new: action<"GET", "/dashboard/tenants/:tenantId/clients/new">(({ tenant, logger }) => {
		let log = logger.loader(`/dashboard/tenants/${tenant.id}/clients/new`);
		log.info("New client form loaded", { tenantId: tenant.id });

		return htmlResponse(
			String(
				layout({
					title: `New Client - ${tenant.name}`,
					tenant,
					backLink: `/dashboard/tenants/${tenant.id}/clients`,
					backText: "Clients",
					content: html`
					<h2 class="text-2xl font-bold mb-6">New Client</h2>

					<form method="POST" action="/dashboard/tenants/${tenant.id}/clients" class="bg-white rounded-lg border p-6 space-y-4 max-w-lg">
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1" for="name">Name</label>
							<input type="text" id="name" name="name" required class="w-full border rounded-lg px-3 py-2" placeholder="My App">
						</div>

						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1" for="type">Type</label>
							<select id="type" name="type" required class="w-full border rounded-lg px-3 py-2">
								<option value="public">Public (SPA, Mobile)</option>
								<option value="confidential">Confidential (Web Server)</option>
								<option value="m2m">Machine-to-Machine</option>
							</select>
							<p class="text-gray-500 text-xs mt-1">Public clients cannot securely store secrets</p>
						</div>

						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1" for="description">Description</label>
							<textarea id="description" name="description" rows="2" class="w-full border rounded-lg px-3 py-2" placeholder="Optional description"></textarea>
						</div>

						<button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
							Create Client
						</button>
					</form>
				`,
				}),
			),
		);
	}),

	create: action<"POST", "/dashboard/tenants/:tenantId/clients">(
		async ({ formData, tenant, tenantApi, logger }) => {
			let log = logger.action(`/dashboard/tenants/${tenant.id}/clients`);

			let body = Object.fromEntries(formData);

			let result = await validate(body, CreateClientSchema);
			if (isFailure(result)) {
				log.info("Client creation validation failed", { issues: result.error.issues.length });
				return new Response("Validation error", { status: 400 });
			}

			let { id } = await tenantApi.createClient({
				name: result.data.name,
				type: result.data.type,
				description: result.data.description,
			});

			log.info("Client created", { tenantId: tenant.id, clientId: id });

			return new Response(null, {
				status: 302,
				headers: { Location: `/dashboard/tenants/${tenant.id}/clients/${id}` },
			});
		},
	),

	edit: action<"GET", "/dashboard/tenants/:tenantId/clients/:id/edit">(
		async ({ params, tenant, tenantApi, logger }) => {
			let log = logger.loader(`/dashboard/tenants/${tenant.id}/clients/${params.id}/edit`);

			let client = await tenantApi.getClient(params.id);
			if (!client) {
				return new Response("Client not found", { status: 404 });
			}

			log.info("Client edit form loaded", { tenantId: tenant.id, clientId: params.id });

			return htmlResponse(
				String(
					layout({
						title: `Edit ${client.name} - ${tenant.name}`,
						tenant,
						backLink: `/dashboard/tenants/${tenant.id}/clients/${params.id}`,
						backText: client.name,
						content: html`
						<h2 class="text-2xl font-bold mb-6">Edit Client</h2>

						<form method="POST" action="/dashboard/tenants/${tenant.id}/clients/${params.id}?_method=PUT" class="bg-white rounded-lg border p-6 space-y-4 max-w-lg">
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1" for="name">Name</label>
								<input type="text" id="name" name="name" value="${client.name}" required class="w-full border rounded-lg px-3 py-2">
							</div>

							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1" for="type">Type</label>
								<select id="type" name="type" required class="w-full border rounded-lg px-3 py-2">
									<option value="public" ${client.type === "public" ? "selected" : ""}>Public (SPA, Mobile)</option>
									<option value="confidential" ${client.type === "confidential" ? "selected" : ""}>Confidential (Web Server)</option>
									<option value="m2m" ${client.type === "m2m" ? "selected" : ""}>Machine-to-Machine</option>
								</select>
							</div>

							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1" for="description">Description</label>
								<textarea id="description" name="description" rows="2" class="w-full border rounded-lg px-3 py-2">${client.description ?? ""}</textarea>
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

	update: action<"PUT", "/dashboard/tenants/:tenantId/clients/:id">(
		async ({ formData, params, tenant, tenantApi, logger }) => {
			let log = logger.action(`/dashboard/tenants/${tenant.id}/clients/${params.id}`);

			let body = Object.fromEntries(formData);

			let result = await validate(body, UpdateClientSchema);
			if (isFailure(result)) {
				log.info("Client update validation failed", { issues: result.error.issues.length });
				return new Response("Validation error", { status: 400 });
			}

			await tenantApi.updateClient(params.id, {
				name: result.data.name,
				description: result.data.description,
				type: result.data.type,
			});

			log.info("Client updated", { tenantId: tenant.id, clientId: params.id });

			return new Response(null, {
				status: 302,
				headers: { Location: `/dashboard/tenants/${tenant.id}/clients/${params.id}` },
			});
		},
	),

	destroy: action<"DELETE", "/dashboard/tenants/:tenantId/clients/:id">(
		async ({ params, tenant, tenantApi, logger }) => {
			let log = logger.action(`/dashboard/tenants/${tenant.id}/clients/${params.id}`);

			await tenantApi.deleteClient(params.id);

			log.info("Client deleted", { tenantId: tenant.id, clientId: params.id });

			return new Response(null, {
				status: 302,
				headers: { Location: `/dashboard/tenants/${tenant.id}/clients` },
			});
		},
	),
};
