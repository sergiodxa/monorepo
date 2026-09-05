/**
 * Tenant OAuth clients controller: lists clients, shows a client (with its secrets,
 * redirect URIs, and logout URIs), and renders/handles the create and edit forms.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as ds from "remix/data-schema";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { ClientTypeBadge, ConfirmButton, MethodInput } from "~/app/views/components";
import { Document } from "~/app/views/document";
import * as s from "~/app/views/styles";
import routes from "~/routes/web";

let CreateClientSchema = ds.object({
	name: ds.string(),
	type: ds.enum_(["public", "confidential", "m2m"]),
	description: ds.optional(ds.string()),
});

let UpdateClientSchema = ds.object({
	name: ds.optional(ds.string()),
	description: ds.optional(ds.nullable(ds.string())),
	type: ds.optional(ds.enum_(["public", "confidential", "m2m"])),
});

export default {
	index: createAction(
		routes.dashboard.tenants.clients.index,
		async ({ tenant, tenantApi, log }) => {
			let ctx = getContext();

			let clients = await tenantApi.listClients();

			log.set({ clients: { count: clients.length } });

			return ctx.render(
				<Document title={`Clients - ${tenant.name}`} tenant={tenant}>
					<div mix={[s.header]}>
						<h2 mix={[s.pageTitle]} style="margin:0">
							Clients
						</h2>
						<a
							mix={[s.button]}
							href={routes.dashboard.tenants.clients.new.href({ tenantId: tenant.id })}
						>
							New Client
						</a>
					</div>
					{clients.length === 0 ? (
						<p mix={[s.muted]}>No clients yet. Create your first client to get started.</p>
					) : (
						<ul mix={[s.listSpaced]}>
							{clients.map((c) => (
								<li mix={[s.listCard]} key={c.id}>
									<a
										mix={[s.linkPlain]}
										href={routes.dashboard.tenants.clients.show.href({
											tenantId: tenant.id,
											id: c.id,
										})}
									>
										<div mix={[s.headerStart]} style="margin:0">
											<div>
												<h3 mix={[s.cardTitle]}>{c.name}</h3>
												<p mix={[s.mutedSmall]}>{c.description ?? "No description"}</p>
											</div>
											<ClientTypeBadge type={c.type} />
										</div>
									</a>
								</li>
							))}
						</ul>
					)}
				</Document>,
			);
		},
	),

	show: createAction(
		routes.dashboard.tenants.clients.show,
		async ({ params, tenant, tenantApi, log }) => {
			let ctx = getContext();
			log.set({ client: { id: params.id } });

			let client = await tenantApi.getClient(params.id);
			if (!client) {
				return new Response("Client not found", { status: 404 });
			}

			let [secrets, redirectUris, logoutUris] = await Promise.all([
				tenantApi.listSecrets(params.id),
				tenantApi.listRedirectUris(params.id),
				tenantApi.listLogoutUris(params.id),
			]);

			return ctx.render(
				<Document
					title={`${client.name} - ${tenant.name}`}
					tenant={tenant}
					backLink={routes.dashboard.tenants.clients.index.href({ tenantId: tenant.id })}
					backText="Clients"
				>
					<div mix={[s.headerStart]}>
						<div>
							<h2 mix={[s.pageTitle]} style="margin:0">
								{client.name}
							</h2>
							<p mix={[s.muted]}>{client.description ?? "No description"}</p>
						</div>
						<div mix={[s.actions]}>
							<a
								mix={[s.linkBlue]}
								href={routes.dashboard.tenants.clients.edit.href({
									tenantId: tenant.id,
									id: params.id,
								})}
							>
								Edit
							</a>
							<form
								mix={[s.inlineFormEl]}
								method="post"
								action={routes.dashboard.tenants.clients.destroy.href({
									tenantId: tenant.id,
									id: params.id,
								})}
							>
								<MethodInput value={routes.dashboard.tenants.clients.destroy.method} />
								<ConfirmButton mix={s.linkRed} message="Delete this client?">
									Delete
								</ConfirmButton>
							</form>
						</div>
					</div>

					<div mix={[s.twoColGrid]}>
						<div mix={[s.card]}>
							<h3 mix={[s.cardTitle]}>Client ID</h3>
							<code mix={[s.codeBlock]}>{client.id}</code>
						</div>
						<div mix={[s.card]}>
							<h3 mix={[s.cardTitle]}>Type</h3>
							<ClientTypeBadge type={client.type} />
						</div>
					</div>

					<div mix={[s.stack]}>
						<section mix={[s.sectionTight]}>
							<div mix={[s.header]}>
								<h3 mix={[s.cardTitle]} style="margin:0">
									Client Secrets
								</h3>
								<a
									mix={[s.linkBlueSm]}
									href={routes.dashboard.tenants.clients.secrets.new.href({
										tenantId: tenant.id,
										clientId: params.id,
									})}
								>
									Add Secret
								</a>
							</div>
							{secrets.length === 0 ? (
								<p mix={[s.mutedSmall]}>No secrets configured</p>
							) : (
								<ul mix={[s.list]}>
									{secrets.map((secret) => (
										<li mix={[s.listRow]} key={secret.id}>
											<span>{secret.name || "Unnamed secret"}</span>
											<form
												mix={[s.inlineFormEl]}
												method="post"
												action={routes.dashboard.tenants.clients.secrets.destroy.href({
													tenantId: tenant.id,
													clientId: params.id,
													id: secret.id,
												})}
											>
												<MethodInput
													value={routes.dashboard.tenants.clients.secrets.destroy.method}
												/>
												<ConfirmButton mix={s.linkRed} message="Revoke this secret?">
													Revoke
												</ConfirmButton>
											</form>
										</li>
									))}
								</ul>
							)}
						</section>

						<section mix={[s.sectionTight]}>
							<div mix={[s.header]}>
								<h3 mix={[s.cardTitle]} style="margin:0">
									Redirect URIs
								</h3>
								<a
									mix={[s.linkBlueSm]}
									href={routes.dashboard.tenants.clients["redirect-uris"].new.href({
										tenantId: tenant.id,
										clientId: params.id,
									})}
								>
									Add URI
								</a>
							</div>
							{redirectUris.length === 0 ? (
								<p mix={[s.mutedSmall]}>No redirect URIs configured</p>
							) : (
								<ul mix={[s.list]}>
									{redirectUris.map((u) => (
										<li mix={[s.listRow]} key={u.id}>
											<code mix={[s.code]}>{u.uri}</code>
											<form
												mix={[s.inlineFormEl]}
												method="post"
												action={routes.dashboard.tenants.clients["redirect-uris"].destroy.href({
													tenantId: tenant.id,
													clientId: params.id,
													id: u.id,
												})}
											>
												<MethodInput
													value={routes.dashboard.tenants.clients["redirect-uris"].destroy.method}
												/>
												<ConfirmButton mix={s.linkRed} message="Remove this URI?">
													Remove
												</ConfirmButton>
											</form>
										</li>
									))}
								</ul>
							)}
						</section>

						<section mix={[s.sectionTight]}>
							<div mix={[s.header]}>
								<h3 mix={[s.cardTitle]} style="margin:0">
									Logout URIs
								</h3>
								<a
									mix={[s.linkBlueSm]}
									href={routes.dashboard.tenants.clients["logout-uris"].new.href({
										tenantId: tenant.id,
										clientId: params.id,
									})}
								>
									Add URI
								</a>
							</div>
							{logoutUris.length === 0 ? (
								<p mix={[s.mutedSmall]}>No logout URIs configured</p>
							) : (
								<ul mix={[s.list]}>
									{logoutUris.map((u) => (
										<li mix={[s.listRow]} key={u.id}>
											<div>
												<code mix={[s.code]}>{u.uri}</code>
												<span mix={[s.muted]} style="margin-left:0.5rem">
													({u.type})
												</span>
											</div>
											<form
												mix={[s.inlineFormEl]}
												method="post"
												action={routes.dashboard.tenants.clients["logout-uris"].destroy.href({
													tenantId: tenant.id,
													clientId: params.id,
													id: u.id,
												})}
											>
												<MethodInput
													value={routes.dashboard.tenants.clients["logout-uris"].destroy.method}
												/>
												<ConfirmButton mix={s.linkRed} message="Remove this URI?">
													Remove
												</ConfirmButton>
											</form>
										</li>
									))}
								</ul>
							)}
						</section>
					</div>
				</Document>,
			);
		},
	),

	new: createAction(routes.dashboard.tenants.clients.new, ({ tenant }) => {
		let ctx = getContext();

		return ctx.render(
			<Document
				title={`New Client - ${tenant.name}`}
				tenant={tenant}
				backLink={routes.dashboard.tenants.clients.index.href({ tenantId: tenant.id })}
				backText="Clients"
			>
				<h2 mix={[s.pageTitle]}>New Client</h2>

				<form
					mix={[s.form]}
					method="post"
					action={routes.dashboard.tenants.clients.create.href({ tenantId: tenant.id })}
				>
					<div mix={[s.field]}>
						<label mix={[s.label]} htmlFor="name">
							Name
						</label>
						<input
							mix={[s.control]}
							type="text"
							id="name"
							name="name"
							required
							placeholder="My App"
						/>
					</div>

					<div mix={[s.field]}>
						<label mix={[s.label]} htmlFor="type">
							Type
						</label>
						<select mix={[s.selectControl]} id="type" name="type" required>
							<option value="public">Public (SPA, Mobile)</option>
							<option value="confidential">Confidential (Web Server)</option>
							<option value="m2m">Machine-to-Machine</option>
						</select>
						<p mix={[s.mutedXs]}>Public clients cannot securely store secrets</p>
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
							placeholder="Optional description"
						/>
					</div>

					<button mix={[s.button, s.buttonBlock]} type="submit">
						Create Client
					</button>
				</form>
			</Document>,
		);
	}),

	create: createAction(
		routes.dashboard.tenants.clients.create,
		async ({ formData, tenant, tenantApi, log }) => {
			let body = Object.fromEntries(formData);

			let result = await validate(body, CreateClientSchema);
			if (isFailure(result)) {
				log.note("client.validation_failed", { issues: result.error.issues.length });
				return new Response("Validation error", { status: 400 });
			}

			let { id } = await tenantApi.createClient({
				name: result.data.name,
				type: result.data.type,
				description: result.data.description,
			});

			log.set({ client: { id } }).note("client.created");

			return new Response(null, {
				status: 302,
				headers: {
					Location: routes.dashboard.tenants.clients.show.href({ tenantId: tenant.id, id }),
				},
			});
		},
	),

	edit: createAction(
		routes.dashboard.tenants.clients.edit,
		async ({ params, tenant, tenantApi, log }) => {
			let ctx = getContext();
			log.set({ client: { id: params.id } });

			let client = await tenantApi.getClient(params.id);
			if (!client) {
				return new Response("Client not found", { status: 404 });
			}

			return ctx.render(
				<Document
					title={`Edit ${client.name} - ${tenant.name}`}
					tenant={tenant}
					backLink={routes.dashboard.tenants.clients.show.href({
						tenantId: tenant.id,
						id: params.id,
					})}
					backText={client.name}
				>
					<h2 mix={[s.pageTitle]}>Edit Client</h2>

					<form
						mix={[s.form]}
						method="post"
						action={routes.dashboard.tenants.clients.update.href({
							tenantId: tenant.id,
							id: params.id,
						})}
					>
						<MethodInput value={routes.dashboard.tenants.clients.update.method} />
						<div mix={[s.field]}>
							<label mix={[s.label]} htmlFor="name">
								Name
							</label>
							<input
								mix={[s.control]}
								type="text"
								id="name"
								name="name"
								defaultValue={client.name}
								required
							/>
						</div>

						<div mix={[s.field]}>
							<label mix={[s.label]} htmlFor="type">
								Type
							</label>
							<select mix={[s.selectControl]} id="type" name="type" required>
								<option value="public" selected={client.type === "public"}>
									Public (SPA, Mobile)
								</option>
								<option value="confidential" selected={client.type === "confidential"}>
									Confidential (Web Server)
								</option>
								<option value="m2m" selected={client.type === "m2m"}>
									Machine-to-Machine
								</option>
							</select>
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
								defaultValue={client.description ?? ""}
							/>
						</div>

						<button mix={[s.button, s.buttonBlock]} type="submit">
							Save Changes
						</button>
					</form>
				</Document>,
			);
		},
	),

	update: createAction(
		routes.dashboard.tenants.clients.update,
		async ({ formData, params, tenant, tenantApi, log }) => {
			log.set({ client: { id: params.id } });

			let body = Object.fromEntries(formData);

			let result = await validate(body, UpdateClientSchema);
			if (isFailure(result)) {
				log.note("client.validation_failed", { issues: result.error.issues.length });
				return new Response("Validation error", { status: 400 });
			}

			await tenantApi.updateClient(params.id, {
				name: result.data.name,
				description: result.data.description,
				type: result.data.type,
			});

			log.note("client.updated");

			return new Response(null, {
				status: 302,
				headers: {
					Location: routes.dashboard.tenants.clients.show.href({
						tenantId: tenant.id,
						id: params.id,
					}),
				},
			});
		},
	),

	destroy: createAction(
		routes.dashboard.tenants.clients.destroy,
		async ({ params, tenant, tenantApi, log }) => {
			log.set({ client: { id: params.id } });

			await tenantApi.deleteClient(params.id);

			log.note("client.deleted");

			return new Response(null, {
				status: 302,
				headers: { Location: routes.dashboard.tenants.clients.index.href({ tenantId: tenant.id }) },
			});
		},
	),
};
