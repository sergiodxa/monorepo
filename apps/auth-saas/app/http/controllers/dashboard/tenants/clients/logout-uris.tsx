/**
 * Tenant client logout-URIs controller: renders the add form, creates a logout
 * URI, and removes one via destroy. Edit and update redirect back to the
 * client, leaving existing logout URIs unchanged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
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
		async ({ params, tenant, tenantApi, log }) => {
			let ctx = getContext();
			log.set({ client: { id: params.clientId } });

			let client = await tenantApi.getClient(params.clientId);
			if (!client) {
				return new Response("Client not found", { status: 404 });
			}

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
		async ({ formData, params, tenant, tenantApi, log }) => {
			log.set({ client: { id: params.clientId } });

			let body = Object.fromEntries(formData);

			let result = await validate(body, CreateLogoutUriSchema);
			if (isFailure(result)) {
				log.note("logout_uri.validation_failed", { issues: result.error.issues.length });
				return new Response("Validation error", { status: 400 });
			}

			let { id } = await tenantApi.createLogoutUri(params.clientId, {
				uri: result.data.uri,
				type: result.data.type,
				environment: result.data.environment,
			});

			log.set({ logout_uri: { id } }).note("logout_uri.added");

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
		async ({ params, tenant, log }) => {
			log.set({ client: { id: params.clientId }, logout_uri: { id: params.id } });

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
		async ({ params, tenant, log }) => {
			log.set({ client: { id: params.clientId }, logout_uri: { id: params.id } });

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
		async ({ params, tenant, tenantApi, log }) => {
			log.set({ client: { id: params.clientId }, logout_uri: { id: params.id } });

			await tenantApi.deleteLogoutUri(params.clientId, params.id);

			log.note("logout_uri.deleted");

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
