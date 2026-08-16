/**
 * Tenant client logout-URIs controller: renders the add form and creates a logout URI,
 * then redirects back to the client. Edit/update are unsupported (redirect no-ops) and
 * destroy removes a URI. Rendering uses `remix/ui` JSX via `ctx.render`.
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

let CreateLogoutUriSchema = ds.object({
	uri: ds.string(),
	type: ds.enum_(["post_logout", "backchannel", "frontchannel"]),
	environment: ds.optional(ds.string()),
});

export default {
	new: createAction(
		routes.dashboard.tenants.clients["logout-uris"].new,
		async ({ params, tenant, tenantApi, logger }) => {
			let ctx = getContext();
			let log = logger.loader(
				`/dashboard/tenants/${tenant.id}/clients/${params.clientId}/logout-uris/new`,
			);

			let client = await tenantApi.getClient(params.clientId);
			if (!client) {
				return new Response("Client not found", { status: 404 });
			}

			log.info("New logout URI form loaded", { tenantId: tenant.id, clientId: params.clientId });

			return ctx.render(
				<Document
					title={`New Logout URI - ${client.name}`}
					tenant={tenant}
					backLink={routes.dashboard.tenants.clients.show.href({
						tenantId: tenant.id,
						id: params.clientId,
					})}
					backText={client.name}
				>
					<h2 mix={[s.pageTitle]}>Add Logout URI</h2>

					<form
						mix={[s.form]}
						method="post"
						action={routes.dashboard.tenants.clients["logout-uris"].create.href({
							tenantId: tenant.id,
							clientId: params.clientId,
						})}
					>
						<div mix={[s.field]}>
							<label mix={[s.label]} htmlFor="uri">
								Logout URI
							</label>
							<input
								mix={[s.control]}
								type="url"
								id="uri"
								name="uri"
								required
								placeholder="https://myapp.com/logout"
							/>
							<p mix={[s.mutedXs]}>The URL where users will be redirected after logout</p>
						</div>

						<div mix={[s.field]}>
							<label mix={[s.label]} htmlFor="type">
								Type
							</label>
							<select mix={[s.selectControl]} id="type" name="type" required>
								<option value="post_logout">Post-Logout Redirect</option>
								<option value="backchannel">Back-Channel Logout</option>
								<option value="frontchannel">Front-Channel Logout</option>
							</select>
							<p mix={[s.mutedXs]}>
								Post-logout: Browser redirect after logout
								<br />
								Back-channel: Server-to-server logout notification
								<br />
								Front-channel: Hidden iframe logout notification
							</p>
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
						</div>

						<button mix={[s.button, s.buttonBlock]} type="submit">
							Add Logout URI
						</button>
					</form>
				</Document>,
			);
		},
	),

	create: createAction(
		routes.dashboard.tenants.clients["logout-uris"].create,
		async ({ formData, params, tenant, tenantApi, logger }) => {
			let log = logger.action(
				`/dashboard/tenants/${tenant.id}/clients/${params.clientId}/logout-uris`,
			);

			let body = Object.fromEntries(formData);

			let result = await validate(body, CreateLogoutUriSchema);
			if (isFailure(result)) {
				log.info("Logout URI validation failed", { issues: result.error.issues.length });
				return new Response("Validation error", { status: 400 });
			}

			await tenantApi.createLogoutUri(params.clientId, {
				uri: result.data.uri,
				type: result.data.type,
				environment: result.data.environment,
			});

			log.info("Logout URI created", { tenantId: tenant.id, clientId: params.clientId });

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
		routes.dashboard.tenants.clients["logout-uris"].edit,
		async ({ params, tenant, logger }) => {
			let log = logger.loader(
				`/dashboard/tenants/${tenant.id}/clients/${params.clientId}/logout-uris/${params.id}/edit`,
			);
			log.info("Logout URI edit not supported - delete and recreate");

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
		routes.dashboard.tenants.clients["logout-uris"].update,
		async ({ params, tenant, logger }) => {
			let log = logger.action(
				`/dashboard/tenants/${tenant.id}/clients/${params.clientId}/logout-uris/${params.id}`,
			);
			log.info("Logout URI update not supported");

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
		routes.dashboard.tenants.clients["logout-uris"].destroy,
		async ({ params, tenant, tenantApi, logger }) => {
			let log = logger.action(
				`/dashboard/tenants/${tenant.id}/clients/${params.clientId}/logout-uris/${params.id}`,
			);

			await tenantApi.deleteLogoutUri(params.clientId, params.id);

			log.info("Logout URI deleted", {
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
