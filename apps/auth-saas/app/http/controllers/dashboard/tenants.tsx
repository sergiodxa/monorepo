/**
 * Platform tenant controller: shows a tenant dashboard, and renders/handles
 * the create and edit forms. Rendering is done with `remix/ui` JSX via
 * `ctx.render`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { inject } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import { env } from "cloudflare:workers";
import * as ds from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { failureFields } from "~/app/lib/billing";
import Hostname from "~/app/models/hostname";
import Subscription from "~/app/models/subscription";
import Tenant from "~/app/models/tenant";
import { TenantApiService } from "~/app/services/tenant-api";
import { StatusBadge } from "~/app/views/components";
import { Document } from "~/app/views/document";
import * as s from "~/app/views/styles";
import routes from "~/routes/web";

let CreateTenantSchema = ds.object({
	name: ds.string(),
	region: ds.enum_(["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"]),
	/** An HTML checkbox submits `"on"` when checked, so this parses as a string. */
	internal: ds.optional(ds.string()),
});

let REGION_NAMES: Record<string, string> = {
	wnam: "Western North America",
	enam: "Eastern North America",
	sam: "South America",
	weur: "Western Europe",
	eeur: "Eastern Europe",
	apac: "Asia Pacific",
	oc: "Oceania",
	afr: "Africa",
	me: "Middle East",
};

let UpdateTenantSchema = ds.object({
	name: ds.optional(ds.string()),
});

let REGION_OPTIONS = ["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"] as const;

export default {
	show: createAction(
		routes.dashboard.tenants.show,
		inject([Database] as const, async (db) => {
			let ctx = getContext();
			let { params, platformSession, log } = ctx;
			let { id } = ds.parse(ds.object({ id: ds.string() }), params);

			let tenant = await Tenant.showWithAccess(
				db,
				id,
				platformSession.subjectId,
				platformSession.email,
			);
			if (!tenant) {
				return new Response("Not found", { status: 404 });
			}

			log.set({ tenant: { id } });

			let api = new TenantApiService(id);
			let [stats, hostnames] = await Promise.all([api.getStats(), Hostname.listByTenant(db, id)]);

			log.set({ hostnames: { count: hostnames.length } });

			let defaultHostname = hostnames.find((h) => Boolean(h.is_default));

			return ctx.render(
				<Document title={tenant.name} backLink={routes.dashboard.index.href()} backText="Dashboard">
					<div mix={[s.header]}>
						<h2 mix={[s.pageTitle]} style="margin:0">
							{tenant.name}
						</h2>
						<a mix={[s.linkBlue]} href={routes.dashboard.tenants.edit.href({ id })}>
							Edit
						</a>
					</div>

					<div mix={[s.statsGrid]}>
						<div mix={[s.card]}>
							<p mix={[s.mutedSmall]}>Users</p>
							<p mix={[s.bigNumber]}>{stats.total_users}</p>
						</div>
						<div mix={[s.card]}>
							<p mix={[s.mutedSmall]}>Clients</p>
							<p mix={[s.bigNumber]}>{stats.total_clients}</p>
						</div>
						<div mix={[s.card]}>
							<p mix={[s.mutedSmall]}>Active Sessions</p>
							<p mix={[s.bigNumber]}>{stats.active_sessions}</p>
						</div>
						<div mix={[s.card]}>
							<p mix={[s.mutedSmall]}>Monthly Active Users</p>
							<p mix={[s.bigNumber]}>{stats.monthly_active_users}</p>
						</div>
					</div>

					<div mix={[s.section]}>
						<h2 mix={[s.sectionTitle]}>Tenant Info</h2>
						<dl mix={[s.defList]}>
							<div>
								<dt mix={[s.dt]}>Slug</dt>
								<dd mix={[s.dd, s.codePlain]}>{tenant.slug}</dd>
							</div>
							<div>
								<dt mix={[s.dt]}>Region</dt>
								<dd mix={[s.dd]}>{REGION_NAMES[tenant.region] ?? tenant.region}</dd>
							</div>
							<div>
								<dt mix={[s.dt]}>Status</dt>
								<dd mix={[s.dd]}>
									<StatusBadge status={tenant.status} />
								</dd>
							</div>
							<div>
								<dt mix={[s.dt]}>Hostname</dt>
								<dd mix={[s.dd, s.codePlain]} style="font-size:0.875rem">
									{defaultHostname ? defaultHostname.hostname : "Not configured"}
								</dd>
							</div>
						</dl>
					</div>

					<div mix={[s.cardGrid]}>
						<a
							mix={[s.linkCard]}
							href={routes.dashboard.tenants.clients.index.href({ tenantId: id })}
						>
							<h3 mix={[s.cardTitle]}>Clients</h3>
							<p mix={[s.mutedSmall]}>Manage OAuth clients</p>
						</a>
						<a
							mix={[s.linkCard]}
							href={routes.dashboard.tenants.users.index.href({ tenantId: id })}
						>
							<h3 mix={[s.cardTitle]}>Users</h3>
							<p mix={[s.mutedSmall]}>Manage users and sessions</p>
						</a>
						<a
							mix={[s.linkCard]}
							href={routes.dashboard.tenants.resources.index.href({ tenantId: id })}
						>
							<h3 mix={[s.cardTitle]}>Resources</h3>
							<p mix={[s.mutedSmall]}>Manage API resources and scopes</p>
						</a>
						<a
							mix={[s.linkCard]}
							href={routes.dashboard.tenants.branding.index.href({ tenantId: id })}
						>
							<h3 mix={[s.cardTitle]}>Branding</h3>
							<p mix={[s.mutedSmall]}>Customize login appearance</p>
						</a>
						<a
							mix={[s.linkCard]}
							href={routes.dashboard.tenants.hostname.index.href({ tenantId: id })}
						>
							<h3 mix={[s.cardTitle]}>Hostname</h3>
							<p mix={[s.mutedSmall]}>Configure custom domain</p>
						</a>
						<a
							mix={[s.linkCard]}
							href={routes.dashboard.tenants.billing.index.href({ tenantId: id })}
						>
							<h3 mix={[s.cardTitle]}>Billing</h3>
							<p mix={[s.mutedSmall]}>Manage subscription</p>
						</a>
					</div>
				</Document>,
			);
		}),
	),

	new: createAction(
		routes.dashboard.tenants.new,
		inject([] as const, () => {
			let ctx = getContext();

			return ctx.render(
				<Document
					title="New Tenant"
					backLink={routes.dashboard.index.href()}
					backText="Back to Dashboard"
				>
					<h1 mix={[s.pageTitle]}>Create New Tenant</h1>

					<form mix={[s.form]} method="post" action={routes.dashboard.tenants.create.href()}>
						<div mix={[s.field]}>
							<label mix={[s.label]} htmlFor="name">
								Tenant Name
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
							<label mix={[s.label]} htmlFor="region">
								Region
							</label>
							<select mix={[s.selectControl]} id="region" name="region" required>
								{REGION_OPTIONS.map((region) => (
									<option value={region} key={region}>
										{REGION_NAMES[region]}
									</option>
								))}
							</select>
							<p mix={[s.mutedXs]}>Choose the region closest to your users</p>
						</div>

						<div mix={[s.field]}>
							<label mix={[s.checkboxLabel]}>
								<input type="checkbox" id="internal" name="internal" />
								<span>Internal tenant (skip billing)</span>
							</label>
							<p mix={[s.mutedXs]}>
								For your own tenants (e.g. sso.sergiodxa.com); no Polar subscription is created.
							</p>
						</div>

						<button mix={[s.button, s.buttonBlock]} type="submit">
							Create Tenant
						</button>
					</form>
				</Document>,
			);
		}),
	),

	/**
	 * Creates the tenant, provisions its default hostname and management
	 * client, and best-effort creates its Polar subscription — a failure here
	 * is recorded on the request log but does not fail tenant creation.
	 */
	create: createAction(
		routes.dashboard.tenants.create,
		inject([Database] as const, async (db) => {
			let { formData, platformSession, log } = getContext();

			let body = Object.fromEntries(formData);

			let result = await validate(body, CreateTenantSchema);
			if (isFailure(result)) {
				log.note("tenant.validation_failed", { issues: result.error.issues.length });
				return getContext().render(
					<html lang="en">
						<head>
							<meta charSet="utf-8" />
							<title>Validation error - Auth SaaS</title>
						</head>
						<body>
							<p>
								Validation error. <a href={routes.dashboard.tenants.new.href()}>Try again</a>
							</p>
						</body>
					</html>,
					{ status: 400 },
				);
			}

			let slug = Tenant.generateSlug(result.data.name);
			/** Internal tenants (the platform owner's own tenants) skip Polar billing entirely. */
			let internal = Boolean(result.data.internal);

			let tenant = await Tenant.create(db, {
				name: result.data.name,
				slug,
				ownerSubjectId: platformSession.subjectId,
				region: result.data.region,
				internal,
			});

			log.set({ tenant: { id: tenant.id, slug, internal } });

			await Hostname.createDefault(db, tenant.id, slug, env.PLATFORM_DOMAIN);

			/** Fetching the stub (HEAD) triggers Durable Object instantiation in the given region. */
			let stub = env.TENANT.get(env.TENANT.idFromName(tenant.id), {
				locationHint: result.data.region,
			});
			await stub.fetch("https://tenant.internal/", { method: "HEAD" });

			/**
			 * The issuer starts as the default hostname; the hostname controller
			 * re-runs setup when a custom domain is activated, so the issuer stays
			 * in sync with the hostname clients use.
			 */
			let tenantApi = new TenantApiService(tenant.id);
			await tenantApi.setup({
				issuer: `${slug}.${env.PLATFORM_DOMAIN}`,
				region: result.data.region,
			});

			let managementClient = await tenantApi.createClient({
				name: "Management Client",
				type: "m2m",
				description: "Auto-generated management client for API access",
				isManagementClient: true,
			});

			try {
				if (internal) {
					log.note("subscription.skipped_internal");
				} else {
					let subscription = await Subscription.create(
						db,
						tenant.id,
						platformSession.email,
						result.data.name,
					);

					if (isFailure(subscription)) {
						log.warn("subscription.create_failed", failureFields(subscription.error));
					} else log.note("subscription.created");
				}
			} catch (error) {
				log.warn("subscription.create_failed", failureFields(error));
			}

			log.set({ client: { id: managementClient.id } }).note("tenant.created");

			return new Response(null, {
				status: 302,
				headers: { Location: routes.dashboard.tenants.show.href({ id: tenant.id }) },
			});
		}),
	),

	edit: createAction(
		routes.dashboard.tenants.edit,
		inject([Database] as const, async (db) => {
			let ctx = getContext();
			let { params, platformSession, log } = ctx;
			let { id } = ds.parse(ds.object({ id: ds.string() }), params);

			let tenant = await Tenant.showWithAccess(
				db,
				id,
				platformSession.subjectId,
				platformSession.email,
			);
			if (!tenant) {
				return new Response("Not found", { status: 404 });
			}

			log.set({ tenant: { id } });

			if (tenant.role === "viewer") {
				return new Response("Forbidden", { status: 403 });
			}

			return ctx.render(
				<Document
					title={`Edit ${tenant.name}`}
					backLink={routes.dashboard.tenants.show.href({ id })}
					backText="Back to Tenant"
				>
					<h1 mix={[s.pageTitle]}>Edit Tenant</h1>

					<form mix={[s.form]} method="post" action={routes.dashboard.tenants.update.href({ id })}>
						<input type="hidden" name="_method" value="PUT" />

						<div mix={[s.field]}>
							<label mix={[s.label]} htmlFor="name">
								Tenant Name
							</label>
							<input
								mix={[s.control]}
								type="text"
								id="name"
								name="name"
								defaultValue={tenant.name}
								required
							/>
						</div>

						<div mix={[s.mutedSmall]}>
							<p>
								<strong>Slug:</strong> {tenant.slug} (cannot be changed)
							</p>
							<p>
								<strong>Region:</strong> {REGION_NAMES[tenant.region] ?? tenant.region} (cannot be
								changed)
							</p>
						</div>

						<button mix={[s.button, s.buttonBlock]} type="submit">
							Save Changes
						</button>
					</form>
				</Document>,
			);
		}),
	),

	update: createAction(
		routes.dashboard.tenants.update,
		inject([Database] as const, async (db) => {
			let { formData, params, platformSession, log } = getContext();
			let { id } = ds.parse(ds.object({ id: ds.string() }), params);

			let tenant = await Tenant.showWithAccess(
				db,
				id,
				platformSession.subjectId,
				platformSession.email,
			);
			if (!tenant) {
				return new Response("Not found", { status: 404 });
			}

			log.set({ tenant: { id } });

			if (tenant.role === "viewer") {
				return new Response("Forbidden", { status: 403 });
			}

			let body = Object.fromEntries(formData);

			let result = await validate(body, UpdateTenantSchema);
			if (isFailure(result)) {
				log.note("tenant.validation_failed", { issues: result.error.issues.length });
				return new Response("Validation error", { status: 400 });
			}

			await Tenant.update(db, id, { name: result.data.name });

			log.note("tenant.updated");

			return new Response(null, {
				status: 302,
				headers: { Location: routes.dashboard.tenants.show.href({ id }) },
			});
		}),
	),
};
