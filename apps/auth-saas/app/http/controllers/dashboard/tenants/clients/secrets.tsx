/**
 * Tenant client secrets controller: renders the generate form, creates a
 * secret shown once, and lets a tenant revoke it via destroy. Edit and update
 * redirect back to the client, leaving existing secrets unchanged.
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

let CreateSecretSchema = ds.object({
	name: ds.optional(ds.string()),
	expiresAt: ds.optional(ds.string()),
});

export default {
	new: createAction(
		routes.dashboard.tenants.clients.secrets.new,
		async ({ params, tenant, tenantApi, log }) => {
			let ctx = getContext();
			log.set({ client: { id: params.clientId } });

			let client = await tenantApi.getClient(params.clientId);
			if (!client) {
				return new Response("Client not found", { status: 404 });
			}

			return ctx.render(
				<Document
					title={`New Secret - ${client.name}`}
					tenant={tenant}
					backLink={routes.dashboard.tenants.clients.show.href({
						tenantId: tenant.id,
						id: params.clientId,
					})}
					backText={client.name}
				>
					<h2 mix={[s.pageTitle]}>Generate New Secret</h2>

					<form
						mix={[s.form]}
						method="post"
						action={routes.dashboard.tenants.clients.secrets.create.href({
							tenantId: tenant.id,
							clientId: params.clientId,
						})}
					>
						<div mix={[s.field]}>
							<label mix={[s.label]} htmlFor="name">
								Name (optional)
							</label>
							<input
								mix={[s.control]}
								type="text"
								id="name"
								name="name"
								placeholder="Production server"
							/>
							<p mix={[s.mutedXs]}>A label to help you identify this secret</p>
						</div>

						<div mix={[s.field]}>
							<label mix={[s.label]} htmlFor="expiresAt">
								Expiration (optional)
							</label>
							<input mix={[s.control]} type="date" id="expiresAt" name="expiresAt" />
							<p mix={[s.mutedXs]}>Leave empty for no expiration</p>
						</div>

						<div mix={[s.noticeYellow]}>
							<p mix={[s.noticeYellowStrong]}>
								<strong>Important:</strong> The secret will only be shown once after creation. Make
								sure to copy it immediately.
							</p>
						</div>

						<button mix={[s.button, s.buttonBlock]} type="submit">
							Generate Secret
						</button>
					</form>
				</Document>,
			);
		},
	),

	create: createAction(
		routes.dashboard.tenants.clients.secrets.create,
		async ({ formData, params, tenant, tenantApi, log }) => {
			let ctx = getContext();
			log.set({ client: { id: params.clientId } });

			let client = await tenantApi.getClient(params.clientId);
			if (!client) {
				return new Response("Client not found", { status: 404 });
			}

			let body = Object.fromEntries(formData);

			let result = await validate(body, CreateSecretSchema);
			if (isFailure(result)) {
				log.note("secret.validation_failed", { issues: result.error.issues.length });
				return new Response("Validation error", { status: 400 });
			}

			let { id, secret } = await tenantApi.createSecret(params.clientId, {
				name: result.data.name,
				expiresAt: result.data.expiresAt,
			});

			log.set({ secret: { id } }).note("secret.created");

			return ctx.render(
				<Document title={`Secret Created - ${client.name}`} tenant={tenant}>
					<h2 mix={[s.pageTitle]}>Secret Created</h2>

					<div mix={[s.noticeGreen]} style="max-width:32rem">
						<p mix={[s.noticeGreenTitle]} style="margin-bottom:1rem">
							Your client secret has been generated:
						</p>
						<div mix={[s.secretBox]}>{secret}</div>
						<p mix={[s.noticeGreenText]} style="margin-top:1rem">
							<strong>Copy this secret now!</strong> It will not be shown again.
						</p>
					</div>

					<a
						mix={[s.linkBlue]}
						href={routes.dashboard.tenants.clients.show.href({
							tenantId: tenant.id,
							id: params.clientId,
						})}
					>
						← Back to {client.name}
					</a>
				</Document>,
			);
		},
	),

	edit: createAction(
		routes.dashboard.tenants.clients.secrets.edit,
		async ({ params, tenant, log }) => {
			log.set({ client: { id: params.clientId }, secret: { id: params.id } });

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
		routes.dashboard.tenants.clients.secrets.update,
		async ({ params, tenant, log }) => {
			log.set({ client: { id: params.clientId }, secret: { id: params.id } });

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
		routes.dashboard.tenants.clients.secrets.destroy,
		async ({ params, tenant, tenantApi, log }) => {
			log.set({ client: { id: params.clientId }, secret: { id: params.id } });

			await tenantApi.deleteSecret(params.clientId, params.id);

			log.note("secret.revoked");

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
