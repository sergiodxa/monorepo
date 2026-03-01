import { html } from "@pkg/http/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";

import { escapeHtml, layout } from "~/app/lib/html";
import tenantOwner from "~/app/middleware/tenant-owner";
import Hostname from "~/app/models/hostname";
import form from "~/lib/form";

let AddHostnameSchema = s.object({
	hostname: s.string(),
});

export default form<"/dashboard/tenants/:tenantId/hostname">({
	middleware: [tenantOwner],

	actions: {
		async index({ db, tenant, logger }) {
			let log = logger.loader(`/dashboard/tenants/${tenant.id}/hostname`);

			let hostnames = await Hostname.listByTenant(db, tenant.id);

			log.info("Hostname form loaded", { tenantId: tenant.id, count: hostnames.length });

			let defaultHostname = hostnames.find((h) => Boolean(h.is_default));
			let customHostnames = hostnames.filter((h) => !h.is_default);

			return html(
				layout({
					title: `Hostname - ${tenant.name}`,
					tenant,
					content: `
						<h2 class="text-2xl font-bold mb-6">Hostname Configuration</h2>
						<p class="text-gray-500 mb-6">Configure custom domains for your authentication endpoints.</p>

						<section class="bg-white rounded-lg border p-6 mb-6">
							<h3 class="font-semibold mb-4">Default Hostname</h3>
							<div class="bg-gray-50 rounded-lg p-4">
								<code class="text-lg">${defaultHostname ? escapeHtml(defaultHostname.hostname) : "Not configured"}</code>
								<p class="text-gray-500 text-sm mt-1">This is automatically assigned and cannot be changed.</p>
							</div>
						</section>

						<section class="bg-white rounded-lg border p-6 mb-6">
							<h3 class="font-semibold mb-4">Custom Hostnames</h3>
							${
								customHostnames.length === 0
									? '<p class="text-gray-500">No custom hostnames configured.</p>'
									: `<ul class="space-y-4 mb-4">${customHostnames
											.map(
												(h) => `
										<li class="flex justify-between items-center border-b pb-4 last:border-0 last:pb-0">
											<div>
												<code class="font-medium">${escapeHtml(h.hostname)}</code>
												<div class="flex items-center gap-2 mt-1">
													<span class="px-2 py-0.5 text-xs rounded ${h.status === "active" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}">
														${h.status}
													</span>
													${h.ssl_status ? `<span class="text-gray-500 text-xs">SSL: ${h.ssl_status}</span>` : ""}
												</div>
												${
													h.status === "pending_validation" && h.validation_txt_name
														? `
													<div class="mt-2 p-3 bg-yellow-50 rounded text-sm">
														<p class="font-medium text-yellow-800">DNS Validation Required</p>
														<p class="text-yellow-700 mt-1">Add this TXT record to your DNS:</p>
														<div class="mt-2 font-mono text-xs bg-white p-2 rounded border">
															<p><strong>Name:</strong> ${escapeHtml(h.validation_txt_name)}</p>
															<p><strong>Value:</strong> ${escapeHtml(h.validation_txt_value || "")}</p>
														</div>
													</div>
												`
														: ""
												}
											</div>
											<form method="POST" action="/dashboard/tenants/${tenant.id}/hostname?action=delete&hostnameId=${h.id}" class="inline">
												<button type="submit" class="text-red-600 hover:text-red-800 text-sm" onclick="return confirm('Remove this hostname?')">Remove</button>
											</form>
										</li>
									`,
											)
											.join("")}</ul>`
							}

							<form method="POST" action="/dashboard/tenants/${tenant.id}/hostname" class="flex gap-2 mt-4">
								<input type="text" name="hostname" placeholder="auth.yourdomain.com" required class="flex-1 border rounded-lg px-3 py-2">
								<button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
									Add Hostname
								</button>
							</form>
						</section>

						<section class="bg-blue-50 rounded-lg border border-blue-200 p-6">
							<h3 class="font-semibold text-blue-900 mb-2">How to set up a custom hostname</h3>
							<ol class="list-decimal list-inside text-blue-800 space-y-1 text-sm">
								<li>Add your hostname using the form above</li>
								<li>Add the TXT record shown to your DNS provider</li>
								<li>Add a CNAME record pointing to <code class="bg-blue-100 px-1 rounded">${defaultHostname?.hostname || "your-tenant.auth.sergiodxa.com"}</code></li>
								<li>Wait for DNS propagation (may take up to 24 hours)</li>
								<li>The hostname will automatically activate once validated</li>
							</ol>
						</section>
					`,
				}),
			);
		},

		async action({ request, db, tenant, logger }) {
			let log = logger.action(`/dashboard/tenants/${tenant.id}/hostname`);

			let url = new URL(request.url);
			let actionType = url.searchParams.get("action");

			if (actionType === "delete") {
				let hostnameId = url.searchParams.get("hostnameId");
				if (hostnameId) {
					let hostname = await Hostname.show(db, hostnameId);
					if (hostname && hostname.tenant_id === tenant.id && !hostname.is_default) {
						await Hostname.destroy(db, hostnameId);
						log.info("Hostname deleted", { tenantId: tenant.id, hostnameId });
					}
				}
			} else {
				let formData = await request.formData();
				let body = Object.fromEntries(formData);

				let result = await validate(body, AddHostnameSchema);
				if (isFailure(result)) {
					log.info("Hostname validation failed", { issues: result.error.issues.length });
					return new Response("Validation error", { status: 400 });
				}

				// Check if hostname already exists
				let existing = await Hostname.findByHostname(db, result.data.hostname);
				if (existing) {
					log.info("Hostname already exists", { hostname: result.data.hostname });
					return new Response("Hostname already in use", { status: 400 });
				}

				// Generate validation token
				let validation = {
					txtName: `_auth-verify.${result.data.hostname}`,
					txtValue: `auth-saas-verify=${crypto.randomUUID()}`,
				};

				await Hostname.createCustom(db, tenant.id, result.data.hostname, validation);
				log.info("Hostname added", { tenantId: tenant.id, hostname: result.data.hostname });
			}

			return new Response(null, {
				status: 302,
				headers: { Location: `/dashboard/tenants/${tenant.id}/hostname` },
			});
		},
	},
});
