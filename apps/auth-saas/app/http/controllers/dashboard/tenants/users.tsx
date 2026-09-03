/**
 * Tenant users controller: lists users, shows a user's detail (sessions, passkeys,
 * authorized apps), and renders/handles the edit form. Rendering uses `remix/ui` JSX
 * via `ctx.render`; all validation, access checks, and redirects are preserved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Location } from "@sdxc/location";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as ds from "remix/data-schema";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { formatUserAgent, getDeviceIcon, parseUserAgent } from "~/app/lib/user-agent";
import { TenantApiError } from "~/app/services/tenant-api";
import { ConfirmButton, MethodInput, RoleBadge } from "~/app/views/components";
import { Document } from "~/app/views/document";
import * as s from "~/app/views/styles";
import routes from "~/routes/web";

let UpdateUserSchema = ds.object({
	displayName: ds.optional(ds.string()),
	username: ds.optional(ds.string()),
	role: ds.optional(ds.enum_(["admin", "user"])),
});

export default {
	index: createAction(
		routes.dashboard.tenants.users.index,
		async ({ tenant, tenantApi, logger }) => {
			let ctx = getContext();
			let log = logger.loader(`/dashboard/tenants/${tenant.id}/users`);

			let users = await tenantApi.listUsers();

			log.info("Users listed", { tenantId: tenant.id, count: users.length });

			return ctx.render(
				<Document title={`Users - ${tenant.name}`} tenant={tenant}>
					<h2 mix={[s.pageTitle]}>Users</h2>
					{users.length === 0 ? (
						<p mix={[s.muted]}>No users yet.</p>
					) : (
						<div mix={[s.tableWrap]}>
							<table mix={[s.table]}>
								<thead>
									<tr mix={[s.theadRow]}>
										<th mix={[s.th]}>User</th>
										<th mix={[s.th]}>Email</th>
										<th mix={[s.th]}>Role</th>
										<th mix={[s.th]}>Created</th>
									</tr>
								</thead>
								<tbody>
									{users.map((u) => (
										<tr key={u.id}>
											<td mix={[s.td]}>
												<a
													mix={[s.rowLink]}
													href={routes.dashboard.tenants.users.show.href({
														tenantId: tenant.id,
														id: u.id,
													})}
												>
													{u.display_name ?? u.username}
												</a>
											</td>
											<td mix={[s.td, s.muted]}>
												{u.email}
												{u.email_verified_at && (
													<span mix={[s.verified]} title="Verified">
														✓
													</span>
												)}
											</td>
											<td mix={[s.td]}>
												<RoleBadge role={u.role} />
											</td>
											<td mix={[s.td, s.muted]}>{new Date(u.created_at).toLocaleDateString()}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</Document>,
			);
		},
	),

	show: createAction(
		routes.dashboard.tenants.users.show,
		async ({ params, tenant, tenantApi, logger, platformSession }) => {
			let ctx = getContext();
			let log = logger.loader(`/dashboard/tenants/${tenant.id}/users/${params.id}`);

			let user = await tenantApi.getUser(params.id);
			if (!user) {
				return new Response("User not found", { status: 404 });
			}

			let [sessions, passkeys, grants] = await Promise.all([
				tenantApi.listUserSessions(params.id),
				tenantApi.listPasskeys(params.id),
				tenantApi.listGrants(params.id),
			]);

			log.info("User retrieved", { tenantId: tenant.id, userId: params.id });

			let currentSessionId = tenant.id === "platform" ? platformSession.sessionId : undefined;

			return ctx.render(
				<Document
					title={`${user.display_name || user.username} - ${tenant.name}`}
					tenant={tenant}
					backLink={routes.dashboard.tenants.users.index.href({ tenantId: tenant.id })}
					backText="Users"
				>
					<div mix={[s.headerStart]}>
						<div>
							<h2 mix={[s.pageTitle]} style="margin:0">
								{user.display_name ?? user.username}
							</h2>
							<p mix={[s.muted]}>{user.email}</p>
						</div>
						<div mix={[s.actions]}>
							<a
								mix={[s.linkBlue]}
								href={routes.dashboard.tenants.users.edit.href({
									tenantId: tenant.id,
									id: params.id,
								})}
							>
								Edit
							</a>
							<form
								mix={[s.inlineFormEl]}
								method="post"
								action={routes.dashboard.tenants.users.destroy.href({
									tenantId: tenant.id,
									id: params.id,
								})}
							>
								<MethodInput value={routes.dashboard.tenants.users.destroy.method} />
								<ConfirmButton mix={s.linkRed} message="Delete this user? This cannot be undone.">
									Delete
								</ConfirmButton>
							</form>
						</div>
					</div>

					<div mix={[s.statsGrid]}>
						<div mix={[s.card]}>
							<p mix={[s.mutedSmall]}>Role</p>
							<RoleBadge role={user.role} />
						</div>
						<div mix={[s.card]}>
							<p mix={[s.mutedSmall]}>Email Verified</p>
							<p mix={[s.cardTitle]} style="margin:0">
								{user.email_verified_at ? "Yes" : "No"}
							</p>
						</div>
						<div mix={[s.card]}>
							<p mix={[s.mutedSmall]}>Created</p>
							<p mix={[s.cardTitle]} style="margin:0">
								{new Date(user.created_at).toLocaleDateString()}
							</p>
						</div>
					</div>

					<div mix={[s.stack]}>
						<section mix={[s.sectionTight]}>
							<h3 mix={[s.sectionTitle]}>Active Sessions ({sessions.length})</h3>
							{sessions.length === 0 ? (
								<p mix={[s.mutedSmall]}>No active sessions</p>
							) : (
								<ul mix={[s.list]}>
									{sessions.map((session) => {
										let parsed = parseUserAgent(session.userAgent);
										let deviceLabel = formatUserAgent(parsed);
										let isActive = new Date(session.expiresAt) > new Date();
										let isCurrentSession = currentSessionId === session.id;
										let lastAccessed = new Date(session.updatedAt).toLocaleDateString("en-US", {
											day: "2-digit",
											month: "short",
											year: "numeric",
										});
										return (
											<li mix={[s.listRowStart]} key={session.id}>
												<div mix={[s.flexShrink]}>{getDeviceIcon(parsed.device)}</div>
												<div mix={[s.sessionInfo]}>
													<div mix={[s.sessionMetaWrap]}>
														<span mix={[s.cardTitle]} style="margin:0">
															{deviceLabel}
														</span>
														{session.ip && <span mix={[s.mutedSmall]}>{session.ip}</span>}
													</div>
													<div mix={[s.sessionMeta]}>
														{isActive ? (
															<span mix={[s.badgePill, s.badgeGreen]}>active</span>
														) : (
															<span mix={[s.badgePill, s.badgeGrayMuted]}>expired</span>
														)}
														{isCurrentSession && (
															<span mix={[s.badgePill, s.badgeBlue]}>Your current session</span>
														)}
													</div>
													<p mix={[s.mutedSmall]}>Last accessed on {lastAccessed}</p>
													{session.client && <p mix={[s.muted]}>{session.client.name}</p>}
												</div>
												<div mix={[s.flexShrink]}>
													{!isCurrentSession && (
														<form
															mix={[s.inlineFormEl]}
															method="post"
															action={routes.dashboard.tenants.users.sessions.destroy.href({
																tenantId: tenant.id,
																userId: params.id,
																id: session.id,
															})}
														>
															<MethodInput
																value={routes.dashboard.tenants.users.sessions.destroy.method}
															/>
															<button mix={[s.linkRedSm]} type="submit">
																Revoke
															</button>
														</form>
													)}
												</div>
											</li>
										);
									})}
								</ul>
							)}
						</section>

						<section mix={[s.sectionTight]}>
							<h3 mix={[s.sectionTitle]}>Passkeys ({passkeys.length})</h3>
							{passkeys.length === 0 ? (
								<p mix={[s.mutedSmall]}>No passkeys registered</p>
							) : (
								<ul mix={[s.list]}>
									{passkeys.map((p) => (
										<li mix={[s.listRow]} key={p.id}>
											<div>
												<p mix={[s.cardTitle]} style="margin:0">
													{p.name ?? "Unnamed passkey"}
												</p>
												<p mix={[s.mutedXs]}>
													{p.deviceType || "Unknown device"} • Last used:{" "}
													{p.lastUsedAt ? new Date(p.lastUsedAt).toLocaleDateString() : "Never"}
												</p>
											</div>
											<form
												mix={[s.inlineFormEl]}
												method="post"
												action={routes.dashboard.tenants.users.passkeys.destroy.href({
													tenantId: tenant.id,
													userId: params.id,
													id: p.id,
												})}
											>
												<MethodInput
													value={routes.dashboard.tenants.users.passkeys.destroy.method}
												/>
												<ConfirmButton mix={s.linkRed} message="Delete this passkey?">
													Delete
												</ConfirmButton>
											</form>
										</li>
									))}
								</ul>
							)}
						</section>

						<section mix={[s.sectionTight]}>
							<h3 mix={[s.sectionTitle]}>Authorized Applications ({grants.length})</h3>
							{grants.length === 0 ? (
								<p mix={[s.mutedSmall]}>No authorized applications</p>
							) : (
								<ul mix={[s.list]}>
									{grants.map((g) => (
										<li mix={[s.listRow]} key={g.id}>
											<div>
												<p mix={[s.cardTitle]} style="margin:0">
													Client: {g.client?.name ?? "Unknown"}
												</p>
												<p mix={[s.mutedXs]}>Scopes: {g.scopes.join(", ")}</p>
											</div>
											<form
												mix={[s.inlineFormEl]}
												method="post"
												action={routes.dashboard.tenants.users.grants.destroy.href({
													tenantId: tenant.id,
													userId: params.id,
													id: g.id,
												})}
											>
												<MethodInput value={routes.dashboard.tenants.users.grants.destroy.method} />
												<ConfirmButton mix={s.linkRed} message="Revoke access?">
													Revoke
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

	edit: createAction(
		routes.dashboard.tenants.users.edit,
		async ({ params, tenant, tenantApi, logger, request }) => {
			let ctx = getContext();
			let log = logger.loader(`/dashboard/tenants/${tenant.id}/users/${params.id}/edit`);

			let user = await tenantApi.getUser(params.id);
			if (!user) {
				return new Response("User not found", { status: 404 });
			}

			let url = new URL(request.url);
			let errorMessage = url.searchParams.get("error");

			log.info("User edit form loaded", { tenantId: tenant.id, userId: params.id });

			return ctx.render(
				<Document
					title={`Edit ${user.display_name || user.username} - ${tenant.name}`}
					tenant={tenant}
					backLink={routes.dashboard.tenants.users.show.href({
						tenantId: tenant.id,
						id: params.id,
					})}
					backText={user.display_name || user.username}
				>
					<h2 mix={[s.pageTitle]}>Edit User</h2>

					{errorMessage && <div mix={[s.errorBanner]}>{errorMessage}</div>}

					<form
						mix={[s.form]}
						method="post"
						action={routes.dashboard.tenants.users.update.href({
							tenantId: tenant.id,
							id: params.id,
						})}
					>
						<MethodInput value={routes.dashboard.tenants.users.update.method} />
						<div mix={[s.field]}>
							<label mix={[s.label]} htmlFor="displayName">
								Display Name
							</label>
							<input
								mix={[s.control]}
								type="text"
								id="displayName"
								name="displayName"
								defaultValue={user.display_name ?? ""}
							/>
						</div>

						<div mix={[s.field]}>
							<label mix={[s.label]} htmlFor="username">
								Username
							</label>
							<input
								mix={[s.control]}
								type="text"
								id="username"
								name="username"
								defaultValue={user.username}
								required
							/>
							<p mix={[s.mutedXs]}>Must be unique across all users in this tenant</p>
						</div>

						<div mix={[s.field]}>
							<label mix={[s.label]} htmlFor="role">
								Role
							</label>
							<select mix={[s.selectControl]} id="role" name="role">
								<option value="user" selected={user.role === "user"}>
									User
								</option>
								<option value="admin" selected={user.role === "admin"}>
									Admin
								</option>
							</select>
						</div>

						<div mix={[s.mutedSmall]}>
							<p>
								<strong>Email:</strong> {user.email} (cannot be changed)
							</p>
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
		routes.dashboard.tenants.users.update,
		async ({ formData, params, tenant, tenantApi, logger }) => {
			let log = logger.action(`/dashboard/tenants/${tenant.id}/users/${params.id}`);

			let body = Object.fromEntries(formData);

			let result = await validate(body, UpdateUserSchema);
			if (isFailure(result)) {
				log.info("User update validation failed", { issues: result.error.issues.length });
				return new Response("Validation error", { status: 400 });
			}

			try {
				await tenantApi.updateUser(params.id, {
					displayName: result.data.displayName,
					username: result.data.username,
					role: result.data.role,
				});

				log.info("User updated", { tenantId: tenant.id, userId: params.id });

				return new Response(null, {
					status: 302,
					headers: {
						Location: routes.dashboard.tenants.users.show.href({
							tenantId: tenant.id,
							id: params.id,
						}),
					},
				});
			} catch (error) {
				if (error instanceof TenantApiError && error.status === 400) {
					log.info("User update failed", {
						tenantId: tenant.id,
						userId: params.id,
						error: error.message,
					});
					let errorMessage = encodeURIComponent(error.message);
					return new Response(null, {
						status: 302,
						headers: {
							Location: new Location({
								pathname: routes.dashboard.tenants.users.edit.href({
									tenantId: tenant.id,
									id: params.id,
								}),
								search: new URLSearchParams({ error: errorMessage }),
							}).toString(),
						},
					});
				}
				throw error;
			}
		},
	),

	destroy: createAction(
		routes.dashboard.tenants.users.destroy,
		async ({ params, tenant, tenantApi, logger }) => {
			let log = logger.action(`/dashboard/tenants/${tenant.id}/users/${params.id}`);

			await tenantApi.deleteUser(params.id);

			log.info("User deleted", { tenantId: tenant.id, userId: params.id });

			return new Response(null, {
				status: 302,
				headers: { Location: routes.dashboard.tenants.users.index.href({ tenantId: tenant.id }) },
			});
		},
	),
};
