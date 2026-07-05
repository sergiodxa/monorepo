/**
 * Tenant API resources controller: lists resources, shows a resource with its scopes,
 * and renders/handles the create and edit forms. Rendering uses `remix/ui` JSX via
 * `ctx.render`; validation, access checks, and redirects are preserved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { getContext } from "remix/async-context-middleware";
import * as ds from "remix/data-schema";
import { createAction } from "remix/fetch-router";

import { ConfirmButton, MethodInput } from "~/app/views/components";
import { Document } from "~/app/views/document";
import * as s from "~/app/views/styles";
import routes from "~/routes/web";

let CreateResourceSchema = ds.object({
	identifier: ds.string(),
	name: ds.string(),
	description: ds.optional(ds.string()),
});

let UpdateResourceSchema = ds.object({
	identifier: ds.optional(ds.string()),
	name: ds.optional(ds.string()),
	description: ds.optional(ds.nullable(ds.string())),
});

export default {
	index: createAction(
		routes.dashboard.tenants.resources.index,
		async ({ tenant, tenantApi, logger }) => {
			let ctx = getContext();
			let log = logger.loader(`/dashboard/tenants/${tenant.id}/resources`);

			let resources = await tenantApi.listResources();

			log.info("Resources listed", { tenantId: tenant.id, count: resources.length });

			return ctx.render(
				<Document title={`Resources - ${tenant.name}`} tenant={tenant}>
					<div mix={[s.header]}>
						<h2 mix={[s.pageTitle]} style="margin:0">
							API Resources
						</h2>
						<a
							mix={[s.button]}
							href={routes.dashboard.tenants.resources.new.href({ tenantId: tenant.id })}
						>
							New Resource
						</a>
					</div>
					{resources.length === 0 ? (
						<p mix={[s.muted]}>No resources yet. Create your first API resource to get started.</p>
					) : (
						<ul mix={[s.listSpaced]}>
							{resources.map((r) => (
								<li mix={[s.listCard]} key={r.id}>
									<a
										mix={[s.linkPlain]}
										href={routes.dashboard.tenants.resources.show.href({
											tenantId: tenant.id,
											id: r.id,
										})}
									>
										<div mix={[s.headerStart]} style="margin:0">
											<div>
												<h3 mix={[s.cardTitle]}>{r.name}</h3>
												<code mix={[s.mutedSmall, s.codePlain]}>{r.identifier}</code>
												<p mix={[s.mutedSmall]}>{r.description ?? "No description"}</p>
											</div>
											<span mix={[s.mutedSmall]}>{r.scopes.length} scopes</span>
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
		routes.dashboard.tenants.resources.show,
		async ({ params, tenant, tenantApi, logger }) => {
			let ctx = getContext();
			let log = logger.loader(`/dashboard/tenants/${tenant.id}/resources/${params.id}`);

			let resource = await tenantApi.getResource(params.id);
			if (!resource) {
				return new Response("Resource not found", { status: 404 });
			}

			log.info("Resource retrieved", { tenantId: tenant.id, resourceId: params.id });

			return ctx.render(
				<Document
					title={`${resource.name} - ${tenant.name}`}
					tenant={tenant}
					backLink={routes.dashboard.tenants.resources.index.href({ tenantId: tenant.id })}
					backText="Resources"
				>
					<div mix={[s.headerStart]}>
						<div>
							<h2 mix={[s.pageTitle]} style="margin:0">
								{resource.name}
							</h2>
							<code mix={[s.muted, s.codePlain]}>{resource.identifier}</code>
							<p mix={[s.muted]}>{resource.description ?? "No description"}</p>
						</div>
						<div mix={[s.actions]}>
							<a
								mix={[s.linkBlue]}
								href={routes.dashboard.tenants.resources.edit.href({
									tenantId: tenant.id,
									id: params.id,
								})}
							>
								Edit
							</a>
							<form
								mix={[s.inlineFormEl]}
								method="post"
								action={routes.dashboard.tenants.resources.destroy.href({
									tenantId: tenant.id,
									id: params.id,
								})}
							>
								<MethodInput value={routes.dashboard.tenants.resources.destroy.method} />
								<ConfirmButton mix={s.linkRed} message="Delete this resource?">
									Delete
								</ConfirmButton>
							</form>
						</div>
					</div>

					<section mix={[s.sectionTight]}>
						<div mix={[s.header]}>
							<h3 mix={[s.cardTitle]} style="margin:0">
								Scopes
							</h3>
							<a
								mix={[s.linkBlueSm]}
								href={routes.dashboard.tenants.resources.scopes.new.href({
									tenantId: tenant.id,
									resourceId: params.id,
								})}
							>
								Add Scope
							</a>
						</div>
						{resource.scopes.length === 0 ? (
							<p mix={[s.mutedSmall]}>No scopes defined</p>
						) : (
							<ul mix={[s.list]}>
								{resource.scopes.map((scope, i) => (
									<li mix={[s.listRow]} key={scope.name}>
										<div>
											<code mix={[s.cardTitle, s.codePlain]}>{scope.name}</code>
											<p mix={[s.mutedSmall]}>{scope.description ?? "No description"}</p>
										</div>
										<form
											mix={[s.inlineFormEl]}
											method="post"
											action={routes.dashboard.tenants.resources.scopes.destroy.href({
												tenantId: tenant.id,
												resourceId: params.id,
												id: i,
											})}
										>
											<MethodInput
												value={routes.dashboard.tenants.resources.scopes.destroy.method}
											/>
											<ConfirmButton mix={s.linkRedSm} message="Remove this scope?">
												Remove
											</ConfirmButton>
										</form>
									</li>
								))}
							</ul>
						)}
					</section>
				</Document>,
			);
		},
	),

	new: createAction(routes.dashboard.tenants.resources.new, ({ tenant, logger }) => {
		let ctx = getContext();
		let log = logger.loader(`/dashboard/tenants/${tenant.id}/resources/new`);
		log.info("New resource form loaded", { tenantId: tenant.id });

		return ctx.render(
			<Document
				title={`New Resource - ${tenant.name}`}
				tenant={tenant}
				backLink={routes.dashboard.tenants.resources.index.href({ tenantId: tenant.id })}
				backText="Resources"
			>
				<h2 mix={[s.pageTitle]}>New API Resource</h2>

				<form
					mix={[s.form]}
					method="post"
					action={routes.dashboard.tenants.resources.create.href({ tenantId: tenant.id })}
				>
					<div mix={[s.field]}>
						<label mix={[s.label]} htmlFor="identifier">
							Identifier (Audience)
						</label>
						<input
							mix={[s.control]}
							type="text"
							id="identifier"
							name="identifier"
							required
							placeholder="https://api.example.com"
						/>
						<p mix={[s.mutedXs]}>Usually a URL that identifies your API</p>
					</div>

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
							placeholder="My API"
						/>
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
						Create Resource
					</button>
				</form>
			</Document>,
		);
	}),

	create: createAction(
		routes.dashboard.tenants.resources.create,
		async ({ formData, tenant, tenantApi, logger }) => {
			let log = logger.action(`/dashboard/tenants/${tenant.id}/resources`);

			let body = Object.fromEntries(formData);

			let result = await validate(body, CreateResourceSchema);
			if (isFailure(result)) {
				log.info("Resource creation validation failed", { issues: result.error.issues.length });
				return new Response("Validation error", { status: 400 });
			}

			let { id } = await tenantApi.createResource({
				identifier: result.data.identifier,
				name: result.data.name,
				description: result.data.description,
				scopes: [],
			});

			log.info("Resource created", { tenantId: tenant.id, resourceId: id });

			return new Response(null, {
				status: 302,
				headers: {
					Location: routes.dashboard.tenants.resources.show.href({ tenantId: tenant.id, id }),
				},
			});
		},
	),

	edit: createAction(
		routes.dashboard.tenants.resources.edit,
		async ({ params, tenant, tenantApi, logger }) => {
			let ctx = getContext();
			let log = logger.loader(`/dashboard/tenants/${tenant.id}/resources/${params.id}/edit`);

			let resource = await tenantApi.getResource(params.id);
			if (!resource) {
				return new Response("Resource not found", { status: 404 });
			}

			log.info("Resource edit form loaded", { tenantId: tenant.id, resourceId: params.id });

			return ctx.render(
				<Document
					title={`Edit ${resource.name} - ${tenant.name}`}
					tenant={tenant}
					backLink={routes.dashboard.tenants.resources.show.href({
						tenantId: tenant.id,
						id: params.id,
					})}
					backText={resource.name}
				>
					<h2 mix={[s.pageTitle]}>Edit Resource</h2>

					<form
						mix={[s.form]}
						method="post"
						action={routes.dashboard.tenants.resources.update.href({
							tenantId: tenant.id,
							id: params.id,
						})}
					>
						<MethodInput value={routes.dashboard.tenants.resources.update.method} />
						<div mix={[s.field]}>
							<label mix={[s.label]} htmlFor="identifier">
								Identifier (Audience)
							</label>
							<input
								mix={[s.control]}
								type="text"
								id="identifier"
								name="identifier"
								defaultValue={resource.identifier}
								required
							/>
						</div>

						<div mix={[s.field]}>
							<label mix={[s.label]} htmlFor="name">
								Name
							</label>
							<input
								mix={[s.control]}
								type="text"
								id="name"
								name="name"
								defaultValue={resource.name}
								required
							/>
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
								defaultValue={resource.description ?? ""}
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
		routes.dashboard.tenants.resources.update,
		async ({ formData, params, tenant, tenantApi, logger }) => {
			let log = logger.action(`/dashboard/tenants/${tenant.id}/resources/${params.id}`);

			let body = Object.fromEntries(formData);

			let result = await validate(body, UpdateResourceSchema);
			if (isFailure(result)) {
				log.info("Resource update validation failed", { issues: result.error.issues.length });
				return new Response("Validation error", { status: 400 });
			}

			await tenantApi.updateResource(params.id, {
				identifier: result.data.identifier,
				name: result.data.name,
				description: result.data.description,
			});

			log.info("Resource updated", { tenantId: tenant.id, resourceId: params.id });

			return new Response(null, {
				status: 302,
				headers: {
					Location: routes.dashboard.tenants.resources.show.href({
						tenantId: tenant.id,
						id: params.id,
					}),
				},
			});
		},
	),

	destroy: createAction(
		routes.dashboard.tenants.resources.destroy,
		async ({ params, tenant, tenantApi, logger }) => {
			let log = logger.action(`/dashboard/tenants/${tenant.id}/resources/${params.id}`);

			await tenantApi.deleteResource(params.id);

			log.info("Resource deleted", { tenantId: tenant.id, resourceId: params.id });

			return new Response(null, {
				status: 302,
				headers: {
					Location: routes.dashboard.tenants.resources.index.href({ tenantId: tenant.id }),
				},
			});
		},
	),
};
