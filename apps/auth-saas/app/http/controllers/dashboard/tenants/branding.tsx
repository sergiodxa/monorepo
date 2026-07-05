/**
 * Tenant branding controller: renders the login-appearance form (logo, colors, custom
 * CSS) and persists it via the tenant API. Rendering uses `remix/ui` JSX via
 * `ctx.render`; validation, the past-due warning, and redirects are preserved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { getContext } from "remix/async-context-middleware";
import * as ds from "remix/data-schema";
import { createController } from "remix/fetch-router";

import subscription from "~/app/http/middleware/subscription";
import tenantOwner from "~/app/http/middleware/tenant-owner";
import { Document } from "~/app/views/document";
import * as s from "~/app/views/styles";
import routes from "~/routes/web";

let UpdateBrandingSchema = ds.object({
	logoUrl: ds.optional(ds.nullable(ds.string())),
	primaryColor: ds.optional(ds.nullable(ds.string())),
	backgroundColor: ds.optional(ds.nullable(ds.string())),
	customCss: ds.optional(ds.nullable(ds.string())),
});

/** Inline script syncing the native color pickers to their paired text inputs. */
let COLOR_PICKER_SCRIPT =
	"document.getElementById('primaryColorPicker').addEventListener('input',function(e){" +
	"document.getElementById('primaryColor').value=e.target.value;});" +
	"document.getElementById('backgroundColorPicker').addEventListener('input',function(e){" +
	"document.getElementById('backgroundColor').value=e.target.value;});";

export default createController(routes.dashboard.tenants.branding, {
	middleware: [tenantOwner, subscription],

	actions: {
		async index({ tenant, tenantApi, subscription, logger }) {
			let ctx = getContext();
			let log = logger.loader(`/dashboard/tenants/${tenant.id}/branding`);

			let branding = await tenantApi.getBranding();

			log.info("Branding form loaded", { tenantId: tenant.id });

			return ctx.render(
				<Document
					title={`Branding - ${tenant.name}`}
					tenant={tenant}
					subscriptionWarning={
						subscription.isPastDue
							? { type: "past_due", billingUrl: `/dashboard/tenants/${tenant.id}/billing` }
							: undefined
					}
				>
					<h2 mix={[s.pageTitle]}>Branding</h2>
					<p mix={[s.lead]}>Customize the appearance of your login pages.</p>

					<form
						mix={[s.form]}
						method="post"
						action={routes.dashboard.tenants.branding.action.href({ tenantId: tenant.id })}
					>
						<div mix={[s.field]}>
							<label mix={[s.label]} htmlFor="logoUrl">
								Logo URL
							</label>
							<input
								mix={[s.control]}
								type="url"
								id="logoUrl"
								name="logoUrl"
								defaultValue={branding?.logo_url ?? ""}
								placeholder="https://example.com/logo.png"
							/>
							<p mix={[s.mutedXs]}>URL to your company logo (recommended: 200x50px)</p>
						</div>

						<div mix={[s.field]}>
							<label mix={[s.label]} htmlFor="primaryColor">
								Primary Color
							</label>
							<div mix={[s.inlineRow]}>
								<input
									mix={[s.colorSwatch]}
									type="color"
									id="primaryColorPicker"
									defaultValue={branding?.primary_color || "#3b82f6"}
								/>
								<input
									mix={[s.control, s.grow]}
									type="text"
									id="primaryColor"
									name="primaryColor"
									defaultValue={branding?.primary_color ?? ""}
									placeholder="#3b82f6"
								/>
							</div>
						</div>

						<div mix={[s.field]}>
							<label mix={[s.label]} htmlFor="backgroundColor">
								Background Color
							</label>
							<div mix={[s.inlineRow]}>
								<input
									mix={[s.colorSwatch]}
									type="color"
									id="backgroundColorPicker"
									defaultValue={branding?.background_color || "#f9fafb"}
								/>
								<input
									mix={[s.control, s.grow]}
									type="text"
									id="backgroundColor"
									name="backgroundColor"
									defaultValue={branding?.background_color ?? ""}
									placeholder="#f9fafb"
								/>
							</div>
						</div>

						<div mix={[s.field]}>
							<label mix={[s.label]} htmlFor="customCss">
								Custom CSS
							</label>
							<textarea
								mix={[s.textareaMono]}
								id="customCss"
								name="customCss"
								rows={4}
								defaultValue={branding?.custom_css ?? ""}
							/>
							<p mix={[s.mutedXs]}>Advanced: Add custom CSS to style login pages</p>
						</div>

						<button mix={[s.button, s.buttonBlock]} type="submit">
							Save Branding
						</button>
					</form>

					<script innerHTML={COLOR_PICKER_SCRIPT} />
				</Document>,
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
