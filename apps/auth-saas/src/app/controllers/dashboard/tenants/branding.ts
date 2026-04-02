import { html as htmlResponse } from "@pkg/http/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import { html } from "remix/html-template";

import { layout } from "~/app/lib/html";
import subscription from "~/app/middleware/subscription";
import tenantOwner from "~/app/middleware/tenant-owner";
import routes from "~/app/routes";
import form from "~/lib/form";

let UpdateBrandingSchema = s.object({
	logoUrl: s.optional(s.nullable(s.string())),
	primaryColor: s.optional(s.nullable(s.string())),
	backgroundColor: s.optional(s.nullable(s.string())),
	customCss: s.optional(s.nullable(s.string())),
});

export default form<"/dashboard/tenants/:tenantId/branding">({
	middleware: [tenantOwner, subscription],

	actions: {
		async index({ tenant, tenantApi, subscription, logger }) {
			let log = logger.loader(`/dashboard/tenants/${tenant.id}/branding`);

			let branding = await tenantApi.getBranding();

			log.info("Branding form loaded", { tenantId: tenant.id });

			return htmlResponse(
				String(
					layout({
						title: `Branding - ${tenant.name}`,
						tenant,
						subscriptionWarning: subscription.isPastDue
							? { type: "past_due", billingUrl: `/dashboard/tenants/${tenant.id}/billing` }
							: undefined,
						content: html`
							<h2 class="text-2xl font-bold mb-6">Branding</h2>
							<p class="text-gray-500 mb-6">Customize the appearance of your login pages.</p>

							<form
								method="POST"
								action="${routes.dashboard.tenants.branding.action.href({ tenantId: tenant.id })}"
								class="bg-white rounded-lg border p-6 space-y-4 max-w-lg"
							>
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1" for="logoUrl">Logo URL</label>
									<input
										type="url"
										id="logoUrl"
										name="logoUrl"
										value="${branding?.logo_url ?? ""}"
										class="w-full border rounded-lg px-3 py-2"
										placeholder="https://example.com/logo.png"
									/>
									<p class="text-gray-500 text-xs mt-1">URL to your company logo (recommended: 200x50px)</p>
								</div>

								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1" for="primaryColor"
										>Primary Color</label
									>
									<div class="flex gap-2">
										<input
											type="color"
											id="primaryColorPicker"
											value="${branding?.primary_color || "#3b82f6"}"
											class="w-12 h-10 rounded border cursor-pointer"
										/>
										<input
											type="text"
											id="primaryColor"
											name="primaryColor"
											value="${branding?.primary_color ?? ""}"
											class="flex-1 border rounded-lg px-3 py-2"
											placeholder="#3b82f6"
										/>
									</div>
								</div>

								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1" for="backgroundColor"
										>Background Color</label
									>
									<div class="flex gap-2">
										<input
											type="color"
											id="backgroundColorPicker"
											value="${branding?.background_color || "#f9fafb"}"
											class="w-12 h-10 rounded border cursor-pointer"
										/>
										<input
											type="text"
											id="backgroundColor"
											name="backgroundColor"
											value="${branding?.background_color ?? ""}"
											class="flex-1 border rounded-lg px-3 py-2"
											placeholder="#f9fafb"
										/>
									</div>
								</div>

								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1" for="customCss">Custom CSS</label>
									<textarea
										id="customCss"
										name="customCss"
										rows="4"
										class="w-full border rounded-lg px-3 py-2 font-mono text-sm"
										placeholder=".login-button { ... }"
									>
							${branding?.custom_css ?? ""}</textarea
									>
									<p class="text-gray-500 text-xs mt-1">Advanced: Add custom CSS to style login pages</p>
								</div>

								<button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
									Save Branding
								</button>
							</form>

							<script>
								document.getElementById("primaryColorPicker").addEventListener("input", (e) => {
									document.getElementById("primaryColor").value = e.target.value;
								});
								document.getElementById("backgroundColorPicker").addEventListener("input", (e) => {
									document.getElementById("backgroundColor").value = e.target.value;
								});
							</script>
						`,
					}),
				),
			);
		},

		async action({ formData, tenant, tenantApi, logger }) {
			let log = logger.action(`/dashboard/tenants/${tenant.id}/branding`);

			let body = Object.fromEntries(formData);

			let result = await validate(body, UpdateBrandingSchema);
			if (isFailure(result)) {
				log.info("Branding update validation failed", { issues: result.error.issues.length });
				return new Response("Validation error", { status: 400 });
			}

			await tenantApi.updateBranding({
				logoUrl: result.data.logoUrl || null,
				primaryColor: result.data.primaryColor || null,
				backgroundColor: result.data.backgroundColor || null,
				customCss: result.data.customCss || null,
			});

			log.info("Branding updated", { tenantId: tenant.id });

			return new Response(null, {
				status: 302,
				headers: {
					Location: routes.dashboard.tenants.branding.index.href({ tenantId: tenant.id }),
				},
			});
		},
	},
});
