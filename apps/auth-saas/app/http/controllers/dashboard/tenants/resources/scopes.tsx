/**
 * Tenant resource scopes controller: renders the add-scope form and appends a
 * scope, then redirects. Edit and update redirect back to the resource,
 * leaving scopes unchanged; destroy removes a scope by index.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as ds from "remix/data-schema";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { Document } from "~/app/views/document";
import * as s from "~/app/views/styles";
import routes from "~/routes/web";

let CreateScopeSchema = ds.object({
	name: ds.string(),
	description: ds.optional(ds.string()),
});

export default {
	new: createAction(
		routes.dashboard.tenants.resources.scopes.new,
		async ({ params, tenant, tenantApi, logger }) => {
			let ctx = getContext();
			let log = logger.loader(
				`/dashboard/tenants/${tenant.id}/resources/${params.resourceId}/scopes/new`,
			);

			let resource = await tenantApi.getResource(params.resourceId);
			if (!resource) {
				return new Response("Resource not found", { status: 404 });
			}

			log.info("New scope form loaded", { tenantId: tenant.id, resourceId: params.resourceId });

			return ctx.render(
				<Document
					title={`New Scope - ${resource.name}`}
					tenant={tenant}
					backLink={routes.dashboard.tenants.resources.show.href({
						tenantId: tenant.id,
						id: params.resourceId,
					})}
					backText={resource.name}
				>
					<h2 mix={[s.pageTitle]}>Add Scope</h2>

					<form
						mix={[s.form]}
						method="post"
						action={routes.dashboard.tenants.resources.scopes.create.href({
							tenantId: tenant.id,
							resourceId: params.resourceId,
						})}
					>
						<div mix={[s.field]}>
							<label mix={[s.label]} htmlFor="name">
								Scope Name
							</label>
							<input
								mix={[s.control]}
								type="text"
								id="name"
								name="name"
								required
								placeholder="read:users"
							/>
							<p mix={[s.mutedXs]}>
								Use lowercase with colons for namespacing (e.g., read:users, write:posts)
							</p>
						</div>

						<div mix={[s.field]}>
							<label mix={[s.label]} htmlFor="description">
								Description
							</label>
							<textarea
								mix={[s.textarea]}
								id="description"
								name="description"
								rows={2}
								placeholder="Read user profile information"
							/>
							<p mix={[s.mutedXs]}>Shown to users during consent</p>
						</div>

						<button mix={[s.button, s.buttonBlock]} type="submit">
							Add Scope
						</button>
					</form>
				</Document>,
			);
		},
	),

	create: createAction(
		routes.dashboard.tenants.resources.scopes.create,
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
				headers: {
					Location: routes.dashboard.tenants.resources.show.href({
						tenantId: tenant.id,
						id: params.resourceId,
					}),
				},
			});
		},
	),

	edit: createAction(
		routes.dashboard.tenants.resources.scopes.edit,
		async ({ params, tenant, logger }) => {
			let log = logger.loader(
				`/dashboard/tenants/${tenant.id}/resources/${params.resourceId}/scopes/${params.id}/edit`,
			);
			log.info("Scope edit not supported - delete and recreate");

			return new Response(null, {
				status: 302,
				headers: {
					Location: routes.dashboard.tenants.resources.show.href({
						tenantId: tenant.id,
						id: params.resourceId,
					}),
				},
			});
		},
	),

	update: createAction(
		routes.dashboard.tenants.resources.scopes.update,
		async ({ params, tenant, logger }) => {
			let log = logger.action(
				`/dashboard/tenants/${tenant.id}/resources/${params.resourceId}/scopes/${params.id}`,
			);
			log.info("Scope update not supported");

			return new Response(null, {
				status: 302,
				headers: {
					Location: routes.dashboard.tenants.resources.show.href({
						tenantId: tenant.id,
						id: params.resourceId,
					}),
				},
			});
		},
	),

	destroy: createAction(
		routes.dashboard.tenants.resources.scopes.destroy,
		async ({ params, tenant, tenantApi, logger }) => {
			let log = logger.action(
				`/dashboard/tenants/${tenant.id}/resources/${params.resourceId}/scopes/${params.id}`,
			);

			let resource = await tenantApi.getResource(params.resourceId);
			if (!resource) {
				return new Response("Resource not found", { status: 404 });
			}

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
				headers: {
					Location: routes.dashboard.tenants.resources.show.href({
						tenantId: tenant.id,
						id: params.resourceId,
					}),
				},
			});
		},
	),
};
