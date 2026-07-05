import type { Database } from "remix/data-table";
import type { RequestContext } from "remix/fetch-router";

import { redirect } from "@pkg/http/response";
import { badRequest, notFound } from "@pkg/http/response/html";
import { createController } from "remix/fetch-router";

import { getAuthUser, getPermissions } from "../../auth/middleware/auth";
import { requirePermission } from "../../auth/middleware/require-permission";
import routes from "../../routes";
import { Settings } from "../../settings/models/settings";
import { CmsLayout } from "../../shared/components/cms-layout";
import * as s from "../../shared/components/styles";
import { PERMISSIONS, PERMISSION_KEYS, type Permission } from "../../shared/permissions";
import { Role, type RoleInput, type RoleWithPermissions } from "../models/role";

async function chrome(db: Database) {
	let user = await getAuthUser();
	let permissions = await getPermissions();
	let siteTitle = await Settings.siteTitle(db);
	return { user, permissions, siteTitle };
}

function label(user: { display_name: string; email: string } | null): string {
	return user ? user.display_name || user.email : "";
}

/** Reads a role form; permissions come from checked checkboxes. */
function readForm(formData: FormData): RoleInput {
	let permissions = PERMISSION_KEYS.filter((key) => formData.get(`perm_${key}`) != null);
	return {
		name: String(formData.get("name") ?? "").trim(),
		label: String(formData.get("label") ?? "").trim(),
		description: String(formData.get("description") ?? ""),
		permissions,
	};
}

async function renderForm(
	ctx: RequestContext,
	role: RoleWithPermissions | undefined,
	title: string,
	error?: string,
): Promise<Response> {
	let { user, permissions, siteTitle } = await chrome(ctx.db);
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
		async index(ctx) {
			let { user, permissions, siteTitle } = await chrome(ctx.db);
			let roles = await Role.findAll(ctx.db);
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
		},

		async new(ctx) {
			return renderForm(ctx, undefined, "New Role");
		},

		async create(ctx) {
			try {
				await Role.create(ctx.db, readForm(ctx.formData));
			} catch (error) {
				return renderForm(ctx, undefined, "New Role", String((error as Error).message));
			}
			return redirect("/cms/roles", { status: redirect.Status.SeeOther });
		},

		async edit(ctx) {
			let role = await Role.findById(ctx.db, ctx.params.id);
			if (!role) return notFound("Not found");
			return renderForm(ctx, role, `Edit ${role.label}`);
		},

		async update(ctx) {
			try {
				await Role.update(ctx.db, ctx.params.id, readForm(ctx.formData));
			} catch (error) {
				let role = await Role.findById(ctx.db, ctx.params.id);
				return renderForm(ctx, role ?? undefined, "Edit Role", String((error as Error).message));
			}
			return redirect("/cms/roles", { status: redirect.Status.SeeOther });
		},

		async destroy(ctx) {
			try {
				await Role.destroy(ctx.db, ctx.params.id);
			} catch (error) {
				return badRequest(String((error as Error).message));
			}
			return redirect("/cms/roles", { status: redirect.Status.SeeOther });
		},
	},
});
