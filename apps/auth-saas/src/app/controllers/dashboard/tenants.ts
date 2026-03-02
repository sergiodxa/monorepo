import { html } from "@pkg/http/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";

import Hostname from "~/app/models/hostname";
import Tenant from "~/app/models/tenant";
import { TenantApiService } from "~/app/services/tenant-api";
import action from "~/lib/action";

const PLATFORM_DOMAIN = "auth.sergiodxa.com";

let CreateTenantSchema = s.object({
	name: s.string(),
	region: s.enum_(["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"]),
});

let UpdateTenantSchema = s.object({
	name: s.optional(s.string()),
});

export default {
	show: action<"GET", "/dashboard/tenants/:id">(async ({ db, params, platformSession, logger }) => {
		let log = logger.loader(`/dashboard/tenants/${params.id}`);

		let tenant = await Tenant.show(db, params.id);
		if (!tenant || tenant.owner_subject_id !== platformSession.subjectId) {
			return new Response("Not found", { status: 404 });
		}

		let api = new TenantApiService(params.id);
		let [stats, hostnames] = await Promise.all([
			api.getStats(),
			Hostname.listByTenant(db, params.id),
		]);

		log.info("Tenant detail loaded", { tenantId: params.id });

		let defaultHostname = hostnames.find((h) => Boolean(h.is_default));

		return html(`
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>${escapeHtml(tenant.name)} - Auth SaaS</title>
				<script src="https://cdn.tailwindcss.com"></script>
			</head>
			<body class="bg-gray-50 min-h-screen">
				<nav class="bg-white shadow-sm border-b">
					<div class="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
						<div class="flex items-center gap-4">
							<a href="/dashboard" class="text-gray-600 hover:text-gray-900">&larr; Dashboard</a>
							<h1 class="text-xl font-bold">${escapeHtml(tenant.name)}</h1>
						</div>
						<a href="/dashboard/tenants/${params.id}/edit" class="text-blue-600 hover:text-blue-800">Edit</a>
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
								<dd class="font-mono">${escapeHtml(tenant.slug)}</dd>
							</div>
							<div>
								<dt class="text-gray-500 text-sm">Region</dt>
								<dd>${escapeHtml(tenant.region)}</dd>
							</div>
							<div>
								<dt class="text-gray-500 text-sm">Status</dt>
								<dd><span class="px-2 py-1 text-xs rounded ${tenant.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}">${tenant.status}</span></dd>
							</div>
							<div>
								<dt class="text-gray-500 text-sm">Hostname</dt>
								<dd class="font-mono text-sm">${defaultHostname ? escapeHtml(defaultHostname.hostname) : "Not configured"}</dd>
							</div>
						</dl>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						<a href="/dashboard/tenants/${params.id}/clients" class="bg-white rounded-lg border p-4 hover:border-blue-500">
							<h3 class="font-semibold">Clients</h3>
							<p class="text-gray-500 text-sm">Manage OAuth clients</p>
						</a>
						<a href="/dashboard/tenants/${params.id}/users" class="bg-white rounded-lg border p-4 hover:border-blue-500">
							<h3 class="font-semibold">Users</h3>
							<p class="text-gray-500 text-sm">Manage users and sessions</p>
						</a>
						<a href="/dashboard/tenants/${params.id}/resources" class="bg-white rounded-lg border p-4 hover:border-blue-500">
							<h3 class="font-semibold">Resources</h3>
							<p class="text-gray-500 text-sm">Manage API resources and scopes</p>
						</a>
						<a href="/dashboard/tenants/${params.id}/branding" class="bg-white rounded-lg border p-4 hover:border-blue-500">
							<h3 class="font-semibold">Branding</h3>
							<p class="text-gray-500 text-sm">Customize login appearance</p>
						</a>
						<a href="/dashboard/tenants/${params.id}/hostname" class="bg-white rounded-lg border p-4 hover:border-blue-500">
							<h3 class="font-semibold">Hostname</h3>
							<p class="text-gray-500 text-sm">Configure custom domain</p>
						</a>
						<a href="/dashboard/tenants/${params.id}/billing" class="bg-white rounded-lg border p-4 hover:border-blue-500">
							<h3 class="font-semibold">Billing</h3>
							<p class="text-gray-500 text-sm">Manage subscription</p>
						</a>
					</div>
				</main>
			</body>
			</html>
		`);
	}),

	new: action<"GET", "/dashboard/tenants/new">(({ logger }) => {
		let log = logger.loader("/dashboard/tenants/new");
		log.info("New tenant form loaded");

		return html(`
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>New Tenant - Auth SaaS</title>
				<script src="https://cdn.tailwindcss.com"></script>
			</head>
			<body class="bg-gray-50 min-h-screen">
				<nav class="bg-white shadow-sm border-b">
					<div class="max-w-6xl mx-auto px-4 py-4">
						<a href="/dashboard" class="text-gray-600 hover:text-gray-900">&larr; Back to Dashboard</a>
					</div>
				</nav>

				<main class="max-w-lg mx-auto px-4 py-8">
					<h1 class="text-2xl font-bold mb-6">Create New Tenant</h1>

					<form method="POST" action="/dashboard/tenants" class="bg-white rounded-lg border p-6 space-y-4">
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1" for="name">Tenant Name</label>
							<input type="text" id="name" name="name" required class="w-full border rounded-lg px-3 py-2" placeholder="My App">
						</div>

						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1" for="region">Region</label>
							<select id="region" name="region" required class="w-full border rounded-lg px-3 py-2">
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
							<p class="text-gray-500 text-xs mt-1">Choose the region closest to your users</p>
						</div>

						<button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
							Create Tenant
						</button>
					</form>
				</main>
			</body>
			</html>
		`);
	}),

	create: action<"POST", "/dashboard/tenants">(async ({ db, request, platformSession, logger }) => {
		let log = logger.action("/dashboard/tenants");

		let formData = await request.formData();
		let body = Object.fromEntries(formData);

		let result = await validate(body, CreateTenantSchema);
		if (isFailure(result)) {
			log.info("Tenant creation validation failed", { issues: result.error.issues.length });
			return html(
				`
				<!DOCTYPE html>
				<html><body>
					<p>Validation error. <a href="/dashboard/tenants/new">Try again</a></p>
				</body></html>
			`,
				{ status: 400 },
			);
		}

		let slug = Tenant.generateSlug(result.data.name);

		// Create the tenant record in platform DB
		let tenant = await Tenant.create(db, {
			name: result.data.name,
			slug,
			ownerSubjectId: platformSession.subjectId,
			region: result.data.region,
		});

		// Create default hostname
		await Hostname.createDefault(db, tenant.id, slug, PLATFORM_DOMAIN);

		// Initialize the tenant DO by calling it (with location hint for region)
		let stub = env.TENANT.get(env.TENANT.idFromName(tenant.id), {
			locationHint: result.data.region,
		});
		await stub.fetch("https://tenant.internal/", { method: "HEAD" });

		// Create default management client via the tenant API
		let tenantApi = new TenantApiService(tenant.id);
		let managementClient = await tenantApi.createClient({
			name: "Management Client",
			type: "m2m",
			description: "Auto-generated management client for API access",
			isManagementClient: true,
		});

		log.info("Tenant created with management client", {
			tenantId: tenant.id,
			slug,
			managementClientId: managementClient.id,
		});

		return new Response(null, {
			status: 302,
			headers: { Location: `/dashboard/tenants/${tenant.id}` },
		});
	}),

	edit: action<"GET", "/dashboard/tenants/:id/edit">(
		async ({ db, params, platformSession, logger }) => {
			let log = logger.loader(`/dashboard/tenants/${params.id}/edit`);

			let tenant = await Tenant.show(db, params.id);
			if (!tenant || tenant.owner_subject_id !== platformSession.subjectId) {
				return new Response("Not found", { status: 404 });
			}

			log.info("Tenant edit form loaded", { tenantId: params.id });

			return html(`
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Edit ${escapeHtml(tenant.name)} - Auth SaaS</title>
				<script src="https://cdn.tailwindcss.com"></script>
			</head>
			<body class="bg-gray-50 min-h-screen">
				<nav class="bg-white shadow-sm border-b">
					<div class="max-w-6xl mx-auto px-4 py-4">
						<a href="/dashboard/tenants/${params.id}" class="text-gray-600 hover:text-gray-900">&larr; Back to Tenant</a>
					</div>
				</nav>

				<main class="max-w-lg mx-auto px-4 py-8">
					<h1 class="text-2xl font-bold mb-6">Edit Tenant</h1>

					<form method="POST" action="/dashboard/tenants/${params.id}?_method=PUT" class="bg-white rounded-lg border p-6 space-y-4">
						<input type="hidden" name="_method" value="PUT">

						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1" for="name">Tenant Name</label>
							<input type="text" id="name" name="name" value="${escapeHtml(tenant.name)}" required class="w-full border rounded-lg px-3 py-2">
						</div>

						<div class="text-gray-500 text-sm">
							<p><strong>Slug:</strong> ${escapeHtml(tenant.slug)} (cannot be changed)</p>
							<p><strong>Region:</strong> ${escapeHtml(tenant.region)} (cannot be changed)</p>
						</div>

						<button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
							Save Changes
						</button>
					</form>
				</main>
			</body>
			</html>
		`);
		},
	),

	update: action<"PUT", "/dashboard/tenants/:id">(
		async ({ db, request, params, platformSession, logger }) => {
			let log = logger.action(`/dashboard/tenants/${params.id}`);

			let tenant = await Tenant.show(db, params.id);
			if (!tenant || tenant.owner_subject_id !== platformSession.subjectId) {
				return new Response("Not found", { status: 404 });
			}

			let formData = await request.formData();
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
				headers: { Location: `/dashboard/tenants/${params.id}` },
			});
		},
	),
};

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}
