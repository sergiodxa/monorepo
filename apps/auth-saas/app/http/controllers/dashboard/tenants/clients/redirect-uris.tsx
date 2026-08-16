/**
 * Tenant client redirect-URIs controller: renders the add form and creates a redirect
 * URI, then redirects back to the client. Edit/update are unsupported (redirect
 * no-ops) and destroy removes a URI. Rendering uses `remix/ui` JSX via `ctx.render`.
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

let CreateRedirectUriSchema = ds.object({
	uri: ds.string(),
	environment: ds.optional(ds.string()),
});

export default {
	new: createAction(
		routes.dashboard.tenants.clients["redirect-uris"].new,
		async ({ params, tenant, tenantApi, logger }) => {
			let ctx = getContext();
			let log = logger.loader(
				`/dashboard/tenants/${tenant.id}/clients/${params.clientId}/redirect-uris/new`,
			);

			let client = await tenantApi.getClient(params.clientId);
			if (!client) {
				return new Response("Client not found", { status: 404 });
			}

			log.info("New redirect URI form loaded", { tenantId: tenant.id, clientId: params.clientId });

			return ctx.render(
				<Document
					title={`New Redirect URI - ${client.name}`}
					tenant={tenant}
					backLink={routes.dashboard.tenants.clients.show.href({
						tenantId: tenant.id,
						id: params.clientId,
					})}
					backText={client.name}
				>
					<h2 mix={[s.pageTitle]}>Add Redirect URI</h2>

					<form
						mix={[s.form]}
						method="post"
						action={routes.dashboard.tenants.clients["redirect-uris"].create.href({
							tenantId: tenant.id,
							clientId: params.clientId,
						})}
					>
						<div mix={[s.field]}>
							<label mix={[s.label]} htmlFor="uri">
								Redirect URI
							</label>
							<input
								mix={[s.control]}
								type="url"
								id="uri"
								name="uri"
								required
								placeholder="https://myapp.com/callback"
							/>
							<p mix={[s.mutedXs]}>The URL where users will be redirected after authentication</p>
						</div>

						<div mix={[s.field]}>
							<label mix={[s.label]} htmlFor="environment">
								Environment (optional)
							</label>
							<select mix={[s.selectControl]} id="environment" name="environment">
								<option value="">Any</option>
								<option value="development">Development</option>
								<option value="staging">Staging</option>
								<option value="production">Production</option>
							</select>
							<p mix={[s.mutedXs]}>Restrict this URI to a specific environment</p>
						</div>

						<button mix={[s.button, s.buttonBlock]} type="submit">
							Add Redirect URI
						</button>
					</form>
				</Document>,
			);
		},
	),

	create: createAction(
		routes.dashboard.tenants.clients["redirect-uris"].create,
		async ({ formData, params, tenant, tenantApi, logger }) => {
			let log = logger.action(
				`/dashboard/tenants/${tenant.id}/clients/${params.clientId}/redirect-uris`,
			);

			let body = Object.fromEntries(formData);

			let result = await validate(body, CreateRedirectUriSchema);
			if (isFailure(result)) {
				log.info("Redirect URI validation failed", { issues: result.error.issues.length });
				return new Response("Validation error", { status: 400 });
			}

			await tenantApi.createRedirectUri(params.clientId, {
				uri: result.data.uri,
				environment: result.data.environment,
			});

			log.info("Redirect URI created", { tenantId: tenant.id, clientId: params.clientId });

			return new Response(null, {
				status: 302,
				headers: {
					Location: routes.dashboard.tenants.clients.show.href({
						tenantId: tenant.id,
						id: params.clientId,
					}),
				},
			});
		},
	),

	edit: createAction(
		routes.dashboard.tenants.clients["redirect-uris"].edit,
		async ({ params, tenant, logger }) => {
			let log = logger.loader(
				`/dashboard/tenants/${tenant.id}/clients/${params.clientId}/redirect-uris/${params.id}/edit`,
			);
			log.info("Redirect URI edit not supported - delete and recreate");

			// Redirect URIs cannot be edited, only deleted and recreated
			return new Response(null, {
				status: 302,
				headers: {
					Location: routes.dashboard.tenants.clients.show.href({
						tenantId: tenant.id,
						id: params.clientId,
					}),
				},
			});
		},
	),

	update: createAction(
		routes.dashboard.tenants.clients["redirect-uris"].update,
		async ({ params, tenant, logger }) => {
			let log = logger.action(
				`/dashboard/tenants/${tenant.id}/clients/${params.clientId}/redirect-uris/${params.id}`,
			);
			log.info("Redirect URI update not supported");

			return new Response(null, {
				status: 302,
				headers: {
					Location: routes.dashboard.tenants.clients.show.href({
						tenantId: tenant.id,
						id: params.clientId,
					}),
				},
			});
		},
	),

	destroy: createAction(
		routes.dashboard.tenants.clients["redirect-uris"].destroy,
		async ({ params, tenant, tenantApi, logger }) => {
			let log = logger.action(
				`/dashboard/tenants/${tenant.id}/clients/${params.clientId}/redirect-uris/${params.id}`,
			);

			await tenantApi.deleteRedirectUri(params.clientId, params.id);

			log.info("Redirect URI deleted", {
				tenantId: tenant.id,
				clientId: params.clientId,
				uriId: params.id,
			});

			return new Response(null, {
				status: 302,
				headers: {
					Location: routes.dashboard.tenants.clients.show.href({
						tenantId: tenant.id,
						id: params.clientId,
					}),
				},
			});
		},
	),
};
