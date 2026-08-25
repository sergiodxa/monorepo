/**
 * Tenant hostname controller: renders the default/custom hostname configuration page
 * (with DNS validation details) and handles add/refresh/delete actions, re-pointing
 * the tenant issuer as needed. Rendering uses `remix/ui` JSX via `ctx.render`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Location } from "@pkg/location";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as ds from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

import type { HostMetadata } from "~/app/lib/host-metadata";

import tenantOwner from "~/app/http/middleware/tenant-owner";
import Hostname from "~/app/models/hostname";
import { ConfirmButton } from "~/app/views/components";
import { Document } from "~/app/views/document";
import * as s from "~/app/views/styles";
import routes from "~/routes/web";

let AddHostnameSchema = ds.object({
	hostname: ds.string(),
});

export default createController(routes.dashboard.tenants.hostname, {
	middleware: [tenantOwner],

	actions: {
		index: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let { tenant, logger } = ctx;
			let log = logger.loader(`/dashboard/tenants/${tenant.id}/hostname`);

			let hostnames = await Hostname.listByTenant(db, tenant.id);

			log.info("Hostname form loaded", { tenantId: tenant.id, count: hostnames.length });

			let defaultHostname = hostnames.find((h) => Boolean(h.is_default));
			let customHostnames = hostnames.filter((h) => !h.is_default);

			return ctx.render(
				<Document title={`Hostname - ${tenant.name}`} tenant={tenant}>
					<h2 mix={[s.pageTitle]}>Hostname Configuration</h2>
					<p mix={[s.lead]}>Configure custom domains for your authentication endpoints.</p>

					<section mix={[s.section]}>
						<h3 mix={[s.cardTitle]}>Default Hostname</h3>
						<div mix={[s.infoBox]}>
							<code mix={[s.codePlain]} style="font-size:1.125rem">
								{defaultHostname ? defaultHostname.hostname : "Not configured"}
							</code>
							<p mix={[s.mutedSmall]}>This is automatically assigned and cannot be changed.</p>
						</div>
					</section>

					<section mix={[s.section]}>
						<h3 mix={[s.cardTitle]}>Custom Hostnames</h3>
						{customHostnames.length === 0 ? (
							<p mix={[s.muted]}>No custom hostnames configured.</p>
						) : (
							<ul mix={[s.list]}>
								{customHostnames.map((h) => (
									<li mix={[s.listRowStart]} key={h.id} style="justify-content:space-between">
										<div>
											<code mix={[s.cardTitle, s.codePlain]}>{h.hostname}</code>
											<div mix={[s.sessionMeta]}>
												<span mix={[s.badge, h.status === "active" ? s.badgeGreen : s.badgeYellow]}>
													{h.status}
												</span>
												{h.ssl_status && <span mix={[s.mutedSmall]}>SSL: {h.ssl_status}</span>}
											</div>
											{h.status === "pending_validation" && h.validation_txt_name && (
												<div mix={[s.validationBox]}>
													<p mix={[s.noticeYellowStrong]}>DNS Validation Required</p>
													<p mix={[s.noticeYellowStrong]} style="font-weight:400">
														Add this TXT record to your DNS:
													</p>
													<div mix={[s.dnsBox]}>
														<p>
															<strong>Name:</strong> {h.validation_txt_name}
														</p>
														<p>
															<strong>Value:</strong> {h.validation_txt_value ?? ""}
														</p>
													</div>
												</div>
											)}
										</div>
										<div mix={[s.actions]}>
											{h.status !== "active" && (
												<form
													mix={[s.inlineFormEl]}
													method="post"
													action={String(
														new Location({
															pathname: routes.dashboard.tenants.hostname.action.href({
																tenantId: tenant.id,
															}),
															search: new URLSearchParams({
																action: "refresh",
																hostnameId: h.id,
															}),
														}),
													)}
												>
													<button mix={[s.linkBlueSm]} type="submit">
														Check Status
													</button>
												</form>
											)}
											<form
												mix={[s.inlineFormEl]}
												method="post"
												action={String(
													new Location({
														pathname: routes.dashboard.tenants.hostname.action.href({
															tenantId: tenant.id,
														}),
														search: new URLSearchParams({ action: "delete", hostnameId: h.id }),
													}),
												)}
											>
												<ConfirmButton mix={s.linkRedSm} message="Remove this hostname?">
													Remove
												</ConfirmButton>
											</form>
										</div>
									</li>
								))}
							</ul>
						)}

						<form
							mix={[s.inlineForm]}
							method="post"
							action={routes.dashboard.tenants.hostname.action.href({ tenantId: tenant.id })}
						>
							<input
								mix={[s.control, s.grow]}
								type="text"
								name="hostname"
								placeholder="auth.yourdomain.com"
								required
							/>
							<button mix={[s.button]} type="submit">
								Add Hostname
							</button>
						</form>
					</section>

					<section mix={[s.sectionBlue]}>
						<h3 mix={[s.sectionBlueTitle]}>How to set up a custom hostname</h3>
						<ol mix={[s.orderedList]}>
							<li>Add your hostname using the form above</li>
							<li>Add the TXT record shown to your DNS provider</li>
							<li>
								Add a CNAME record pointing to{" "}
								<code mix={[s.code]}>
									{defaultHostname?.hostname ?? "your-tenant.auth.sergiodxa.com"}
								</code>
							</li>
							<li>Wait for DNS propagation (may take up to 24 hours)</li>
							<li>The hostname will automatically activate once validated</li>
						</ol>
					</section>
				</Document>,
			);
		}),

		/**
		 * Deleting or activating a hostname can change which one is canonical, so
		 * the tenant issuer is re-pointed to keep discovery, tokens, and WebAuthn
		 * RP resolving against a hostname that is still valid.
		 */
		action: inject([Database] as const, async (db) => {
			let { request, formData, tenant, tenantApi, logger } = getContext();
			let log = logger.action(`/dashboard/tenants/${tenant.id}/hostname`);

			let url = new URL(request.url);
			let actionType = url.searchParams.get("action");

			if (actionType === "delete") {
				let hostnameId = url.searchParams.get("hostnameId");
				if (hostnameId) {
					let hostname = await Hostname.show(db, hostnameId);
					if (hostname && hostname.tenant_id === tenant.id && !hostname.is_default) {
						await Hostname.destroy(db, hostnameId);
						log.info("Hostname deleted", { tenantId: tenant.id, hostnameId });
						if (hostname.status === "active") {
							let remaining = await Hostname.listByTenant(db, tenant.id);
							let nextIssuer =
								remaining.find((h) => !h.is_default && h.status === "active") ??
								remaining.find((h) => h.is_default);
							if (nextIssuer) {
								await tenantApi.setup({ issuer: nextIssuer.hostname, region: tenant.region });
								log.info("Tenant issuer reset after hostname deletion", {
									tenantId: tenant.id,
									issuer: nextIssuer.hostname,
								});
							}
						}
					}
				}
			} else if (actionType === "refresh") {
				let hostnameId = url.searchParams.get("hostnameId");
				if (hostnameId) {
					let hostname = await Hostname.show(db, hostnameId);
					if (hostname && hostname.tenant_id === tenant.id) {
						let refreshed = await Hostname.refresh(db, hostnameId);
						log.info("Hostname refreshed", { tenantId: tenant.id, hostnameId });
						if (!refreshed.is_default && refreshed.status === "active") {
							await tenantApi.setup({ issuer: refreshed.hostname, region: tenant.region });
							log.info("Tenant issuer updated to custom hostname", {
								tenantId: tenant.id,
								issuer: refreshed.hostname,
							});
						}
					}
				}
			} else {
				let body = Object.fromEntries(formData);

				let result = await validate(body, AddHostnameSchema);
				if (isFailure(result)) {
					log.info("Hostname validation failed", { issues: result.error.issues.length });
					return new Response("Validation error", { status: 400 });
				}

				let existing = await Hostname.findByHostname(db, result.data.hostname);
				if (existing) {
					log.info("Hostname already exists", { hostname: result.data.hostname });
					return new Response("Hostname already in use", { status: 400 });
				}

				try {
					await Hostname.createCustom(
						db,
						tenant.id,
						result.data.hostname,
						tenant.region as HostMetadata["region"],
					);
					log.info("Hostname added via Cloudflare", {
						tenantId: tenant.id,
						hostname: result.data.hostname,
					});
				} catch (error) {
					if (error instanceof Hostname.CloudflareApiError) {
						log.error("Cloudflare API error", {
							tenantId: tenant.id,
							hostname: result.data.hostname,
							error: error.message,
						});
						return new Response(`Cloudflare error: ${error.message}`, { status: 400 });
					}
					throw error;
				}
			}

			return new Response(null, {
				status: 302,
				headers: {
					Location: routes.dashboard.tenants.hostname.index.href({ tenantId: tenant.id }),
				},
			});
		}),
	},
});
