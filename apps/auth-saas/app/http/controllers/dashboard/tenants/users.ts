import { html as htmlResponse } from "@pkg/http/response";
import { Location } from "@pkg/location";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import { html } from "remix/html-template";

import action from "~/app/lib/action";
import { formatUserAgent, getDeviceIcon, parseUserAgent } from "~/app/lib/user-agent";
import { TenantApiError } from "~/app/services/tenant-api";
import { layout } from "~/resources/layouts/document";
import routes from "~/routes/web";

let UpdateUserSchema = s.object({
	displayName: s.optional(s.string()),
	username: s.optional(s.string()),
	role: s.optional(s.enum_(["admin", "user"])),
});

export default {
	index: action<"GET", "/dashboard/tenants/:tenantId/users">(
		async ({ tenant, tenantApi, logger }) => {
			let log = logger.loader(`/dashboard/tenants/${tenant.id}/users`);

			let users = await tenantApi.listUsers();

			log.info("Users listed", { tenantId: tenant.id, count: users.length });

			let usersHtml =
				users.length === 0
					? html` <p class="text-gray-500">No users yet.</p> `
					: html`<div class="bg-white rounded-lg border overflow-hidden">
							<table class="w-full">
								<thead class="bg-gray-50">
									<tr>
										<th class="text-left px-4 py-3 text-sm font-medium text-gray-500">User</th>
										<th class="text-left px-4 py-3 text-sm font-medium text-gray-500">Email</th>
										<th class="text-left px-4 py-3 text-sm font-medium text-gray-500">Role</th>
										<th class="text-left px-4 py-3 text-sm font-medium text-gray-500">Created</th>
									</tr>
								</thead>
								<tbody class="divide-y">
									${users.map(
										(u) => html`
											<tr class="hover:bg-gray-50">
												<td class="px-4 py-3">
													<a
														href="${routes.dashboard.tenants.users.show.href({
															tenantId: tenant.id,
															id: u.id,
														})}"
														class="font-medium text-blue-600 hover:text-blue-800"
													>
														${u.display_name ?? u.username}
													</a>
												</td>
												<td class="px-4 py-3 text-sm text-gray-600">
													${u.email}
													${u.email_verified_at
														? html` <span class="ml-1 text-green-600" title="Verified">✓</span> `
														: null}
												</td>
												<td class="px-4 py-3">
													<span
														class="px-2 py-1 text-xs rounded ${u.role === "admin"
															? "bg-purple-100 text-purple-800"
															: "bg-gray-100 text-gray-800"}"
													>
														${u.role}
													</span>
												</td>
												<td class="px-4 py-3 text-sm text-gray-500">
													${new Date(u.created_at).toLocaleDateString()}
												</td>
											</tr>
										`,
									)}
								</tbody>
							</table>
						</div>`;

			return htmlResponse(
				String(
					layout({
						title: `Users - ${tenant.name}`,
						tenant,
						content: html`
							<h2 class="text-2xl font-bold mb-6">Users</h2>
							${usersHtml}
						`,
					}),
				),
			);
		},
	),

	show: action<"GET", "/dashboard/tenants/:tenantId/users/:id">(
		async ({ params, tenant, tenantApi, logger, platformSession }) => {
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

			// Check if we're viewing the platform tenant and the current user
			let currentSessionId = tenant.id === "platform" ? platformSession.sessionId : undefined;

			let sessionsList =
				sessions.length === 0
					? html` <p class="text-gray-500 text-sm">No active sessions</p> `
					: html`<ul class="divide-y">
							${sessions.map((s) => {
								let parsed = parseUserAgent(s.userAgent);
								let deviceLabel = formatUserAgent(parsed);
								let isActive = new Date(s.expiresAt) > new Date();
								let isCurrentSession = currentSessionId === s.id;
								let lastAccessed = new Date(s.updatedAt).toLocaleDateString("en-US", {
									day: "2-digit",
									month: "short",
									year: "numeric",
								});
								return html`
									<li class="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
										<div class="flex-shrink-0 pt-1">${getDeviceIcon(parsed.device)}</div>
										<div class="flex-1 min-w-0">
											<div class="flex items-center gap-2 flex-wrap">
												<span class="font-medium text-gray-900">${deviceLabel}</span>
												${s.ip ? html`<span class="text-gray-500 text-sm">${s.ip}</span>` : ""}
											</div>
											<div class="flex items-center gap-2 mt-1">
												${isActive
													? html`
															<span
																class="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full"
																>active</span
															>
														`
													: html`
															<span
																class="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full"
																>expired</span
															>
														`}
												${isCurrentSession
													? html`
															<span
																class="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full"
																>Your current session</span
															>
														`
													: ""}
											</div>
											<p class="text-gray-500 text-sm mt-1">Last accessed on ${lastAccessed}</p>
											${s.client ? html`<p class="text-gray-600 text-sm">${s.client.name}</p>` : ""}
										</div>
										<div class="flex-shrink-0">
											${isCurrentSession
												? ""
												: html`
														<form
															method="POST"
															action="${routes.dashboard.tenants.users.sessions.destroy.href({
																tenantId: tenant.id,
																userId: params.id,
																id: s.id,
															})}"
															class="inline"
														>
															<input
																type="hidden"
																name="_method"
																value="${routes.dashboard.tenants.users.sessions.destroy.method}"
															/>
															<button type="submit" class="text-red-600 hover:text-red-800 text-sm">
																Revoke
															</button>
														</form>
													`}
										</div>
									</li>
								`;
							})}
						</ul>`;

			let passkeysList =
				passkeys.length === 0
					? html` <p class="text-gray-500 text-sm">No passkeys registered</p> `
					: html`<ul class="space-y-2">
							${passkeys.map(
								(p) => html`
									<li
										class="flex justify-between items-center text-sm border-b pb-2 last:border-0 last:pb-0"
									>
										<div>
											<p class="font-medium">${p.name ?? "Unnamed passkey"}</p>
											<p class="text-gray-400 text-xs">
												${p.deviceType || "Unknown device"} • Last used:
												${p.lastUsedAt ? new Date(p.lastUsedAt).toLocaleDateString() : "Never"}
											</p>
										</div>
										<form
											method="POST"
											action="${routes.dashboard.tenants.users.passkeys.destroy.href({
												tenantId: tenant.id,
												userId: params.id,
												id: p.id,
											})}"
											class="inline"
										>
											<input
												type="hidden"
												name="_method"
												value="${routes.dashboard.tenants.users.passkeys.destroy.method}"
											/>
											<button
												type="submit"
												class="text-red-600 hover:text-red-800"
												onclick="return confirm('Delete this passkey?')"
											>
												Delete
											</button>
										</form>
									</li>
								`,
							)}
						</ul>`;

			let grantsList =
				grants.length === 0
					? html` <p class="text-gray-500 text-sm">No authorized applications</p> `
					: html`<ul class="space-y-2">
							${grants.map(
								(g) => html`
									<li
										class="flex justify-between items-center text-sm border-b pb-2 last:border-0 last:pb-0"
									>
										<div>
											<p class="font-medium">Client: ${g.client?.name ?? "Unknown"}</p>
											<p class="text-gray-400 text-xs">Scopes: ${g.scopes.join(", ")}</p>
										</div>
										<form
											method="POST"
											action="${routes.dashboard.tenants.users.grants.destroy.href({
												tenantId: tenant.id,
												userId: params.id,
												id: g.id,
											})}"
											class="inline"
										>
											<input
												type="hidden"
												name="_method"
												value="${routes.dashboard.tenants.users.grants.destroy.method}"
											/>
											<button
												type="submit"
												class="text-red-600 hover:text-red-800"
												onclick="return confirm('Revoke access?')"
											>
												Revoke
											</button>
										</form>
									</li>
								`,
							)}
						</ul>`;

			return htmlResponse(
				String(
					layout({
						title: `${user.display_name || user.username} - ${tenant.name}`,
						tenant,
						backLink: routes.dashboard.tenants.users.index.href({ tenantId: tenant.id }),
						backText: "Users",
						content: html`
							<div class="flex justify-between items-start mb-6">
								<div>
									<h2 class="text-2xl font-bold">${user.display_name ?? user.username}</h2>
									<p class="text-gray-500">${user.email}</p>
								</div>
								<div class="flex gap-2">
									<a
										href="${routes.dashboard.tenants.users.edit.href({
											tenantId: tenant.id,
											id: params.id,
										})}"
										class="text-blue-600 hover:text-blue-800"
										>Edit</a
									>
									<form
										method="POST"
										action="${routes.dashboard.tenants.users.destroy.href({
											tenantId: tenant.id,
											id: params.id,
										})}"
										class="inline"
									>
										<input
											type="hidden"
											name="_method"
											value="${routes.dashboard.tenants.users.destroy.method}"
										/>
										<button
											type="submit"
											class="text-red-600 hover:text-red-800"
											onclick="return confirm('Delete this user? This cannot be undone.')"
										>
											Delete
										</button>
									</form>
								</div>
							</div>

							<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
								<div class="bg-white rounded-lg border p-4">
									<p class="text-gray-500 text-sm">Role</p>
									<span
										class="px-2 py-1 text-xs rounded ${user.role === "admin"
											? "bg-purple-100 text-purple-800"
											: "bg-gray-100 text-gray-800"}"
									>
										${user.role}
									</span>
								</div>
								<div class="bg-white rounded-lg border p-4">
									<p class="text-gray-500 text-sm">Email Verified</p>
									<p class="font-semibold">${user.email_verified_at ? "Yes" : "No"}</p>
								</div>
								<div class="bg-white rounded-lg border p-4">
									<p class="text-gray-500 text-sm">Created</p>
									<p class="font-semibold">${new Date(user.created_at).toLocaleDateString()}</p>
								</div>
							</div>

							<div class="space-y-6">
								<section class="bg-white rounded-lg border p-4">
									<h3 class="font-semibold mb-4">Active Sessions (${sessions.length})</h3>
									${sessionsList}
								</section>

								<section class="bg-white rounded-lg border p-4">
									<h3 class="font-semibold mb-4">Passkeys (${passkeys.length})</h3>
									${passkeysList}
								</section>

								<section class="bg-white rounded-lg border p-4">
									<h3 class="font-semibold mb-4">Authorized Applications (${grants.length})</h3>
									${grantsList}
								</section>
							</div>
						`,
					}),
				),
			);
		},
	),

	edit: action<"GET", "/dashboard/tenants/:tenantId/users/:id/edit">(
		async ({ params, tenant, tenantApi, logger, request }) => {
			let log = logger.loader(`/dashboard/tenants/${tenant.id}/users/${params.id}/edit`);

			let user = await tenantApi.getUser(params.id);
			if (!user) {
				return new Response("User not found", { status: 404 });
			}

			// Check for error message from redirect
			let url = new URL(request.url);
			let errorMessage = url.searchParams.get("error");

			log.info("User edit form loaded", { tenantId: tenant.id, userId: params.id });

			return htmlResponse(
				String(
					layout({
						title: `Edit ${user.display_name || user.username} - ${tenant.name}`,
						tenant,
						backLink: routes.dashboard.tenants.users.show.href({
							tenantId: tenant.id,
							id: params.id,
						}),
						backText: user.display_name || user.username,
						content: html`
							<h2 class="text-2xl font-bold mb-6">Edit User</h2>

							${errorMessage
								? html`<div
										class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4"
									>
										${errorMessage}
									</div>`
								: ""}

							<form
								method="POST"
								action="${routes.dashboard.tenants.users.update.href({
									tenantId: tenant.id,
									id: params.id,
								})}"
								class="bg-white rounded-lg border p-6 space-y-4 max-w-lg"
							>
								<input
									type="hidden"
									name="_method"
									value="${routes.dashboard.tenants.users.update.method}"
								/>
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1" for="displayName"
										>Display Name</label
									>
									<input
										type="text"
										id="displayName"
										name="displayName"
										value="${user.display_name ?? ""}"
										class="w-full border rounded-lg px-3 py-2"
									/>
								</div>

								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1" for="username"
										>Username</label
									>
									<input
										type="text"
										id="username"
										name="username"
										value="${user.username}"
										class="w-full border rounded-lg px-3 py-2"
										required
									/>
									<p class="text-xs text-gray-500 mt-1">
										Must be unique across all users in this tenant
									</p>
								</div>

								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1" for="role"
										>Role</label
									>
									<select id="role" name="role" class="w-full border rounded-lg px-3 py-2">
										<option value="user" ${user.role === "user" ? "selected" : ""}>User</option>
										<option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option>
									</select>
								</div>

								<div class="text-gray-500 text-sm">
									<p><strong>Email:</strong> ${user.email} (cannot be changed)</p>
								</div>

								<button
									type="submit"
									class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
								>
									Save Changes
								</button>
							</form>
						`,
					}),
				),
			);
		},
	),

	update: action<"PUT", "/dashboard/tenants/:tenantId/users/:id">(
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
					// Redirect back to edit page with error message
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

	destroy: action<"DELETE", "/dashboard/tenants/:tenantId/users/:id">(
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
