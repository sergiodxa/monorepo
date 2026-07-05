import type { RequestContext } from "remix/fetch-router";

import { html as htmlResponse } from "@pkg/http/response";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { env } from "cloudflare:workers";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { html } from "remix/html-template";

import Hostname from "~/app/models/hostname";
import Subscription from "~/app/models/subscription";
import Tenant from "~/app/models/tenant";
import { TenantApiService } from "~/app/services/tenant-api";
import routes from "~/routes/web";

let CreateTenantSchema = s.object({
	name: s.string(),
	region: s.enum_(["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"]),
	// HTML checkbox: present ("on") when the tenant should skip billing.
	internal: s.optional(s.string()),
});

/** Maps region codes to user-friendly display names. */
let REGION_NAMES: Record<string, string> = {
	wnam: "Western North America",
	enam: "Eastern North America",
	sam: "South America",
	weur: "Western Europe",
	eeur: "Eastern Europe",
	apac: "Asia Pacific",
	oc: "Oceania",
	afr: "Africa",
	me: "Middle East",
};

let UpdateTenantSchema = s.object({
	name: s.optional(s.string()),
});

export default {
	show: createAction(
		routes.dashboard.tenants.show,
		inject([Database] as const, async (db) => {
			let { params, platformSession, logger } = getContext() as RequestContext<{ id: string }>;
			let log = logger.loader(`/dashboard/tenants/${params.id}`);

			let tenant = await Tenant.showWithAccess(
				db,
				params.id,
				platformSession.subjectId,
				platformSession.email,
			);
			if (!tenant) {
				return new Response("Not found", { status: 404 });
			}

			let api = new TenantApiService(params.id);
			let [stats, hostnames] = await Promise.all([
				api.getStats(),
				Hostname.listByTenant(db, params.id),
			]);

			log.info("Tenant detail loaded", { tenantId: params.id });

			let defaultHostname = hostnames.find((h) => Boolean(h.is_default));

			return htmlResponse(
				String(html`
					<!DOCTYPE html>
					<html lang="en">
						<head>
							<meta charset="UTF-8" />
							<meta name="viewport" content="width=device-width, initial-scale=1.0" />
							<title>${tenant.name} - Auth SaaS</title>
							<script src="https://cdn.tailwindcss.com"></script>
						</head>
						<body class="bg-gray-50 min-h-screen">
							<nav class="bg-white shadow-sm border-b">
								<div class="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
									<div class="flex items-center gap-4">
										<a
											href="${routes.dashboard.index.href()}"
											class="text-gray-600 hover:text-gray-900"
											>&larr; Dashboard</a
										>
										<h1 class="text-xl font-bold">${tenant.name}</h1>
									</div>
									<a
										href="${routes.dashboard.tenants.edit.href({ id: params.id })}"
										class="text-blue-600 hover:text-blue-800"
										>Edit</a
									>
								</div>
							</nav>

							<main class="max-w-6xl mx-auto px-4 py-8">
								<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
									<div class="bg-white rounded-lg border p-4">
										<p class="text-gray-500 text-sm">Users</p>
										<p class="text-2xl font-bold">${stats.total_users}</p>
									</div>
									<div class="bg-white rounded-lg border p-4">
										<p class="text-gray-500 text-sm">Clients</p>
										<p class="text-2xl font-bold">${stats.total_clients}</p>
									</div>
									<div class="bg-white rounded-lg border p-4">
										<p class="text-gray-500 text-sm">Active Sessions</p>
										<p class="text-2xl font-bold">${stats.active_sessions}</p>
									</div>
									<div class="bg-white rounded-lg border p-4">
										<p class="text-gray-500 text-sm">Monthly Active Users</p>
										<p class="text-2xl font-bold">${stats.monthly_active_users}</p>
									</div>
								</div>

								<div class="bg-white rounded-lg border p-6 mb-8">
									<h2 class="text-lg font-semibold mb-4">Tenant Info</h2>
									<dl class="grid grid-cols-2 gap-4">
										<div>
											<dt class="text-gray-500 text-sm">Slug</dt>
											<dd class="font-mono">${tenant.slug}</dd>
										</div>
										<div>
											<dt class="text-gray-500 text-sm">Region</dt>
											<dd>${REGION_NAMES[tenant.region] ?? tenant.region}</dd>
										</div>
										<div>
											<dt class="text-gray-500 text-sm">Status</dt>
											<dd>
												<span
													class="px-2 py-1 text-xs rounded ${tenant.status === "active"
														? "bg-green-100 text-green-800"
														: "bg-gray-100 text-gray-800"}"
													>${tenant.status}</span
												>
											</dd>
										</div>
										<div>
											<dt class="text-gray-500 text-sm">Hostname</dt>
											<dd class="font-mono text-sm">
												${defaultHostname ? defaultHostname.hostname : "Not configured"}
											</dd>
										</div>
									</dl>
								</div>

								<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
									<a
										href="${routes.dashboard.tenants.clients.index.href({ tenantId: params.id })}"
										class="bg-white rounded-lg border p-4 hover:border-blue-500"
									>
										<h3 class="font-semibold">Clients</h3>
										<p class="text-gray-500 text-sm">Manage OAuth clients</p>
									</a>
									<a
										href="${routes.dashboard.tenants.users.index.href({ tenantId: params.id })}"
										class="bg-white rounded-lg border p-4 hover:border-blue-500"
									>
										<h3 class="font-semibold">Users</h3>
										<p class="text-gray-500 text-sm">Manage users and sessions</p>
									</a>
									<a
										href="${routes.dashboard.tenants.resources.index.href({ tenantId: params.id })}"
										class="bg-white rounded-lg border p-4 hover:border-blue-500"
									>
										<h3 class="font-semibold">Resources</h3>
										<p class="text-gray-500 text-sm">Manage API resources and scopes</p>
									</a>
									<a
										href="${routes.dashboard.tenants.branding.index.href({ tenantId: params.id })}"
										class="bg-white rounded-lg border p-4 hover:border-blue-500"
									>
										<h3 class="font-semibold">Branding</h3>
										<p class="text-gray-500 text-sm">Customize login appearance</p>
									</a>
									<a
										href="${routes.dashboard.tenants.hostname.index.href({ tenantId: params.id })}"
										class="bg-white rounded-lg border p-4 hover:border-blue-500"
									>
										<h3 class="font-semibold">Hostname</h3>
										<p class="text-gray-500 text-sm">Configure custom domain</p>
									</a>
									<a
										href="${routes.dashboard.tenants.billing.index.href({ tenantId: params.id })}"
										class="bg-white rounded-lg border p-4 hover:border-blue-500"
									>
										<h3 class="font-semibold">Billing</h3>
										<p class="text-gray-500 text-sm">Manage subscription</p>
									</a>
								</div>
							</main>
						</body>
					</html>
				`),
			);
		}),
	),

	new: createAction(
		routes.dashboard.tenants.new,
		inject([] as const, () => {
			let { logger } = getContext();
			let log = logger.loader("/dashboard/tenants/new");
			log.info("New tenant form loaded");

			return htmlResponse(
				String(html`
					<!DOCTYPE html>
					<html lang="en">
						<head>
							<meta charset="UTF-8" />
							<meta name="viewport" content="width=device-width, initial-scale=1.0" />
							<title>New Tenant - Auth SaaS</title>
							<script src="https://cdn.tailwindcss.com"></script>
						</head>
						<body class="bg-gray-50 min-h-screen">
							<nav class="bg-white shadow-sm border-b">
								<div class="max-w-6xl mx-auto px-4 py-4">
									<a
										href="${routes.dashboard.index.href()}"
										class="text-gray-600 hover:text-gray-900"
										>&larr; Back to Dashboard</a
									>
								</div>
							</nav>

							<main class="max-w-lg mx-auto px-4 py-8">
								<h1 class="text-2xl font-bold mb-6">Create New Tenant</h1>

								<form
									method="POST"
									action="${routes.dashboard.tenants.create.href()}"
									class="bg-white rounded-lg border p-6 space-y-4"
								>
									<div>
										<label class="block text-sm font-medium text-gray-700 mb-1" for="name"
											>Tenant Name</label
										>
										<input
											type="text"
											id="name"
											name="name"
											required
											class="w-full border rounded-lg px-3 py-2"
											placeholder="My App"
										/>
									</div>

									<div>
										<label class="block text-sm font-medium text-gray-700 mb-1" for="region"
											>Region</label
										>
										<select
											id="region"
											name="region"
											required
											class="w-full border rounded-lg px-3 py-2"
										>
											<option value="wnam">Western North America</option>
											<option value="enam">Eastern North America</option>
											<option value="sam">South America</option>
											<option value="weur">Western Europe</option>
											<option value="eeur">Eastern Europe</option>
											<option value="apac">Asia Pacific</option>
											<option value="oc">Oceania</option>
											<option value="afr">Africa</option>
											<option value="me">Middle East</option>
										</select>
										<p class="text-gray-500 text-xs mt-1">
											Choose the region closest to your users
										</p>
									</div>

									<div class="mb-4">
										<label class="flex items-center gap-2 text-sm">
											<input type="checkbox" id="internal" name="internal" />
											<span>Internal tenant (skip billing)</span>
										</label>
										<p class="text-gray-500 text-xs mt-1">
											For your own tenants (e.g. sso.sergiodxa.com); no Polar subscription is
											created.
										</p>
									</div>

									<button
										type="submit"
										class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
									>
										Create Tenant
									</button>
								</form>
							</main>
						</body>
					</html>
				`),
			);
		}),
	),

	create: createAction(
		routes.dashboard.tenants.create,
		inject([Database] as const, async (db) => {
			let { formData, platformSession, logger } = getContext();
			let log = logger.action("/dashboard/tenants");

			let body = Object.fromEntries(formData);

			let result = await validate(body, CreateTenantSchema);
			if (isFailure(result)) {
				log.info("Tenant creation validation failed", { issues: result.error.issues.length });
				return htmlResponse(
					String(html`
						<!DOCTYPE html>
						<html>
							<body>
								<p>
									Validation error. <a href="${routes.dashboard.tenants.new.href()}">Try again</a>
								</p>
							</body>
						</html>
					`),
					{ status: 400 },
				);
			}

			let slug = Tenant.generateSlug(result.data.name);
			let internal = Boolean(result.data.internal);

			// Create the tenant record in platform DB
			let tenant = await Tenant.create(db, {
				name: result.data.name,
				slug,
				ownerSubjectId: platformSession.subjectId,
				region: result.data.region,
				internal,
			});

			// Create default hostname
			await Hostname.createDefault(db, tenant.id, slug, env.PLATFORM_DOMAIN);

			// Initialize the tenant DO by calling it (with location hint for region)
			let stub = env.TENANT.get(env.TENANT.idFromName(tenant.id), {
				locationHint: result.data.region,
			});
			await stub.fetch("https://tenant.internal/", { method: "HEAD" });

			// Provision tenant metadata (issuer + region). The issuer starts as the
			// default hostname; the hostname controller re-runs setup when a custom
			// domain is activated, so the issuer tracks the hostname clients use.
			let tenantApi = new TenantApiService(tenant.id);
			await tenantApi.setup({
				issuer: `${slug}.${env.PLATFORM_DOMAIN}`,
				region: result.data.region,
			});

			// Create default management client via the tenant API
			let managementClient = await tenantApi.createClient({
				name: "Management Client",
				type: "m2m",
				description: "Auto-generated management client for API access",
				isManagementClient: true,
			});

			// Create subscription with Polar customer. Internal tenants (the owner's
			// own tenants) are exempt from billing and skip this entirely.
			try {
				if (internal) {
					log.info("Skipping subscription for internal tenant", { tenantId: tenant.id });
				} else {
					await Subscription.create(db, tenant.id, platformSession.email, result.data.name);
					log.info("Subscription created", { tenantId: tenant.id });
				}
			} catch (error) {
				// Log but don't fail tenant creation if Polar is unavailable
				log.error("Failed to create subscription", {
					tenantId: tenant.id,
					error: error instanceof Error ? error.message : String(error),
				});
			}

			log.info("Tenant created with management client", {
				tenantId: tenant.id,
				slug,
				managementClientId: managementClient.id,
			});

			return new Response(null, {
				status: 302,
				headers: { Location: routes.dashboard.tenants.show.href({ id: tenant.id }) },
			});
		}),
	),

	edit: createAction(
		routes.dashboard.tenants.edit,
		inject([Database] as const, async (db) => {
			let { params, platformSession, logger } = getContext() as RequestContext<{ id: string }>;
			let log = logger.loader(`/dashboard/tenants/${params.id}/edit`);

			let tenant = await Tenant.showWithAccess(
				db,
				params.id,
				platformSession.subjectId,
				platformSession.email,
			);
			if (!tenant) {
				return new Response("Not found", { status: 404 });
			}

			// Only owners and admins can edit
			if (tenant.role === "viewer") {
				return new Response("Forbidden", { status: 403 });
			}

			log.info("Tenant edit form loaded", { tenantId: params.id });

			return htmlResponse(
				String(html`
					<!DOCTYPE html>
					<html lang="en">
						<head>
							<meta charset="UTF-8" />
							<meta name="viewport" content="width=device-width, initial-scale=1.0" />
							<title>Edit ${tenant.name} - Auth SaaS</title>
							<script src="https://cdn.tailwindcss.com"></script>
						</head>
						<body class="bg-gray-50 min-h-screen">
							<nav class="bg-white shadow-sm border-b">
								<div class="max-w-6xl mx-auto px-4 py-4">
									<a
										href="${routes.dashboard.tenants.show.href({ id: params.id })}"
										class="text-gray-600 hover:text-gray-900"
										>&larr; Back to Tenant</a
									>
								</div>
							</nav>

							<main class="max-w-lg mx-auto px-4 py-8">
								<h1 class="text-2xl font-bold mb-6">Edit Tenant</h1>

								<form
									method="POST"
									action="${routes.dashboard.tenants.update.href({ id: params.id })}"
									class="bg-white rounded-lg border p-6 space-y-4"
								>
									<input type="hidden" name="_method" value="PUT" />

									<div>
										<label class="block text-sm font-medium text-gray-700 mb-1" for="name"
											>Tenant Name</label
										>
										<input
											type="text"
											id="name"
											name="name"
											value="${tenant.name}"
											required
											class="w-full border rounded-lg px-3 py-2"
										/>
									</div>

									<div class="text-gray-500 text-sm">
										<p><strong>Slug:</strong> ${tenant.slug} (cannot be changed)</p>
										<p>
											<strong>Region:</strong> ${REGION_NAMES[tenant.region] ?? tenant.region}
											(cannot be changed)
										</p>
									</div>

									<button
										type="submit"
										class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
									>
										Save Changes
									</button>
								</form>
							</main>
						</body>
					</html>
				`),
			);
		}),
	),

	update: createAction(
		routes.dashboard.tenants.update,
		inject([Database] as const, async (db) => {
			let { formData, params, platformSession, logger } = getContext() as RequestContext<{
				id: string;
			}>;
			let log = logger.action(`/dashboard/tenants/${params.id}`);

			let tenant = await Tenant.showWithAccess(
				db,
				params.id,
				platformSession.subjectId,
				platformSession.email,
			);
			if (!tenant) {
				return new Response("Not found", { status: 404 });
			}

			// Only owners and admins can update
			if (tenant.role === "viewer") {
				return new Response("Forbidden", { status: 403 });
			}

			let body = Object.fromEntries(formData);

			let result = await validate(body, UpdateTenantSchema);
			if (isFailure(result)) {
				log.info("Tenant update validation failed", { issues: result.error.issues.length });
				return new Response("Validation error", { status: 400 });
			}

			await Tenant.update(db, params.id, { name: result.data.name });

			log.info("Tenant updated", { tenantId: params.id });

			return new Response(null, {
				status: 302,
				headers: { Location: routes.dashboard.tenants.show.href({ id: params.id }) },
			});
		}),
	),
};
