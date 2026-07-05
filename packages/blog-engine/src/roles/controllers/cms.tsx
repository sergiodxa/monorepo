/**
 * The role management controller at `/cms/roles`: create, edit, and delete custom
 * roles, choosing permissions from the catalog via checkboxes. Gated by
 * `roles.manage`; built-in roles are protected by the model layer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Database } from "remix/data-table";

import { redirect } from "@pkg/http/response";
import { badRequest, notFound } from "@pkg/http/response/html";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database as DatabaseKey } from "remix/data-table";
import { createController } from "remix/fetch-router";

import { getAuthUser, getPermissions } from "../../auth/middleware/auth";
import { requirePermission } from "../../auth/middleware/require-permission";
import routes from "../../routes";
import { Settings } from "../../settings/models/settings";
import { CmsLayout } from "../../shared/components/cms-layout";
import * as s from "../../shared/components/styles";
import { PERMISSIONS, PERMISSION_KEYS, type Permission } from "../../shared/permissions";
import { Role, type RoleInput, type RoleWithPermissions } from "../models/role";

/**
 * Loads the shared CMS chrome (current user, permission set, site title) for a view.
 * @param db - Database handle.
 * @returns The current user, their permissions, and the site title.
 */
async function chrome(db: Database) {
	let user = getAuthUser();
	let permissions = await getPermissions();
	let siteTitle = await Settings.siteTitle(db);
	return { user, permissions, siteTitle };
}

/**
 * Renders a user's display label, falling back to their email.
 * @param user - The user, or null.
 * @returns The display name, the email, or `""` when null.
 */
function label(user: { display_name: string; email: string } | null): string {
	return user ? user.display_name || user.email : "";
}

/**
 * Reads a role form; the selected permissions come from checked checkboxes.
 * @param formData - The submitted form data.
 * @returns The parsed role input.
 */
function readForm(formData: FormData): RoleInput {
	let permissions = PERMISSION_KEYS.filter((key) => formData.get(`perm_${key}`) != null);
	return {
		name: String(formData.get("name") ?? "").trim(),
		label: String(formData.get("label") ?? "").trim(),
		description: String(formData.get("description") ?? ""),
		permissions,
	};
}

/**
 * Renders the role create/edit form document via the request's renderer, pre-checking
 * the role's permissions and disabling edits for built-in roles.
 * @param db - Database handle (used to load the CMS chrome).
 * @param role - The role being edited, or undefined when creating.
 * @param title - The page/heading title.
 * @param error - Optional error message to display.
 * @returns The rendered form response.
 */
async function renderForm(
	db: Database,
	role: RoleWithPermissions | undefined,
	title: string,
	error?: string,
): Promise<Response> {
	let ctx = getContext();
	let { user, permissions, siteTitle } = await chrome(db);
	let granted = new Set<Permission>(role?.permissions ?? []);
	return ctx.render(
		<CmsLayout
			title={title}
			siteTitle={siteTitle}
			userLabel={label(user)}
			permissions={permissions}
			notice={error}
		>
			<form method="post">
				<label mix={[s.label]} htmlFor="name">
					Name (machine)
				</label>
				<input
					mix={[s.control]}
					type="text"
					id="name"
					name="name"
					defaultValue={role?.name ?? ""}
					readonly={role?.builtin}
				/>
				<label mix={[s.label]} htmlFor="label">
					Label
				</label>
				<input
					mix={[s.control]}
					type="text"
					id="label"
					name="label"
					defaultValue={role?.label ?? ""}
				/>
				<label mix={[s.label]} htmlFor="description">
					Description
				</label>
				<input
					mix={[s.control]}
					type="text"
					id="description"
					name="description"
					defaultValue={role?.description ?? ""}
				/>
				<fieldset>
					<legend>Permissions</legend>
					{PERMISSION_KEYS.map((key) => (
						<label mix={[s.label]} key={key}>
							<input
								type="checkbox"
								name={`perm_${key}`}
								defaultChecked={granted.has(key)}
								disabled={role?.builtin}
							/>{" "}
							<code>{key}</code> — {PERMISSIONS[key]}
						</label>
					))}
				</fieldset>
				{role?.builtin && (
					<p mix={[s.help]}>
						Built-in roles keep their permissions; only label/description can change.
					</p>
				)}
				<p>
					<button mix={[s.button]} type="submit">
						Save
					</button>{" "}
					<a mix={[s.button, s.buttonSecondary]} href="/cms/roles">
						Cancel
					</a>
				</p>
			</form>
		</CmsLayout>,
	);
}

/** `/cms/roles` — create, edit, and delete custom roles (gated by `roles.manage`). */
export default createController(routes.cms.roles, {
	middleware: [requirePermission("roles.manage")],
	actions: {
		index: inject([DatabaseKey] as const, async (db) => {
			let ctx = getContext();
			let { user, permissions, siteTitle } = await chrome(db);
			let roles = await Role.findAll(db);
			return ctx.render(
				<CmsLayout
					title="Roles"
					siteTitle={siteTitle}
					userLabel={label(user)}
					permissions={permissions}
				>
					<p>
						<a mix={[s.button]} href="/cms/roles/new">
							New role
						</a>
					</p>
					<table mix={[s.table]}>
						<thead>
							<tr>
								<th mix={[s.cell]}>Label</th>
								<th mix={[s.cell]}>Name</th>
								<th mix={[s.cell]}>Kind</th>
								<th mix={[s.cell]} />
							</tr>
						</thead>
						<tbody>
							{roles.map((role) => (
								<tr key={role.id}>
									<td mix={[s.cell]}>{role.label}</td>
									<td mix={[s.cell]}>{role.name}</td>
									<td mix={[s.cell]}>{role.builtin ? "built-in" : "custom"}</td>
									<td mix={[s.cell]}>
										<a href={`/cms/roles/${role.id}/edit`}>Edit</a>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</CmsLayout>,
			);
		}),

		new: inject([DatabaseKey] as const, async (db) => {
			return renderForm(db, undefined, "New Role");
		}),

		create: inject([DatabaseKey] as const, async (db) => {
			let ctx = getContext();
			try {
				await Role.create(db, readForm(ctx.formData));
			} catch (error) {
				return renderForm(db, undefined, "New Role", String((error as Error).message));
			}
			return redirect("/cms/roles", { status: redirect.Status.SeeOther });
		}),

		edit: inject([DatabaseKey] as const, async (db) => {
			let ctx = getContext();
			let role = await Role.findById(db, ctx.params.id!);
			if (!role) return notFound("Not found");
			return renderForm(db, role, `Edit ${role.label}`);
		}),

		update: inject([DatabaseKey] as const, async (db) => {
			let ctx = getContext();
			try {
				await Role.update(db, ctx.params.id!, readForm(ctx.formData));
			} catch (error) {
				let role = await Role.findById(db, ctx.params.id!);
				return renderForm(db, role ?? undefined, "Edit Role", String((error as Error).message));
			}
			return redirect("/cms/roles", { status: redirect.Status.SeeOther });
		}),

		destroy: inject([DatabaseKey] as const, async (db) => {
			let ctx = getContext();
			try {
				await Role.destroy(db, ctx.params.id!);
			} catch (error) {
				return badRequest(String((error as Error).message));
			}
			return redirect("/cms/roles", { status: redirect.Status.SeeOther });
		}),
	},
});
