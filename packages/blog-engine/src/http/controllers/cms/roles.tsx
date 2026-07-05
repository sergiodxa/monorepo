import type { Database } from "remix/data-table";

import { redirect } from "@pkg/http/response";
import { badRequest, notFound, ok } from "@pkg/http/response/html";

import { PERMISSIONS, PERMISSION_KEYS, type Permission } from "../../../domain/permissions";
import { Role, type RoleInput, type RoleWithPermissions } from "../../../domain/role";
import { Settings } from "../../../domain/settings";
import action from "../../../shared/lib/action";
import { renderDocument } from "../../../shared/lib/render";
import { getAuthUser, getPermissions } from "../../../shared/middleware/auth";
import { CmsLayout } from "../../../views/cms-layout";

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
	db: Database,
	role: RoleWithPermissions | undefined,
	title: string,
	error?: string,
): Promise<string> {
	let { user, permissions, siteTitle } = await chrome(db);
	let granted = new Set<Permission>(role?.permissions ?? []);
	return renderDocument(
		<CmsLayout
			title={title}
			siteTitle={siteTitle}
			userLabel={label(user)}
			permissions={permissions}
			notice={error}
		>
			<form method="post">
				<label htmlFor="name">Name (machine)</label>
				<input
					type="text"
					id="name"
					name="name"
					defaultValue={role?.name ?? ""}
					readonly={role?.builtin}
				/>
				<label htmlFor="label">Label</label>
				<input type="text" id="label" name="label" defaultValue={role?.label ?? ""} />
				<label htmlFor="description">Description</label>
				<input
					type="text"
					id="description"
					name="description"
					defaultValue={role?.description ?? ""}
				/>
				<fieldset>
					<legend>Permissions</legend>
					{PERMISSION_KEYS.map((key) => (
						<label key={key}>
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
					<p class="help">
						Built-in roles keep their permissions; only label/description can change.
					</p>
				)}
				<p>
					<button type="submit">Save</button>{" "}
					<a class="btn secondary" href="/cms/roles">
						Cancel
					</a>
				</p>
			</form>
		</CmsLayout>,
	);
}

export const index = action<"GET", "/cms/roles">(async ({ db }) => {
	let { user, permissions, siteTitle } = await chrome(db);
	let roles = await Role.findAll(db);
	let body = await renderDocument(
		<CmsLayout
			title="Roles"
			siteTitle={siteTitle}
			userLabel={label(user)}
			permissions={permissions}
		>
			<p>
				<a class="btn" href="/cms/roles/new">
					New role
				</a>
			</p>
			<table>
				<thead>
					<tr>
						<th>Label</th>
						<th>Name</th>
						<th>Kind</th>
						<th />
					</tr>
				</thead>
				<tbody>
					{roles.map((role) => (
						<tr key={role.id}>
							<td>{role.label}</td>
							<td>{role.name}</td>
							<td>{role.builtin ? "built-in" : "custom"}</td>
							<td>
								<a href={`/cms/roles/${role.id}/edit`}>Edit</a>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</CmsLayout>,
	);
	return ok(body);
});

export const newRole = action<"GET", "/cms/roles/new">(async ({ db }) => {
	return ok(await renderForm(db, undefined, "New Role"));
});

export const create = action<"POST", "/cms/roles">(async ({ db, formData }) => {
	try {
		await Role.create(db, readForm(formData));
	} catch (error) {
		return badRequest(
			await renderForm(db, undefined, "New Role", String((error as Error).message)),
		);
	}
	return redirect("/cms/roles", { status: redirect.Status.SeeOther });
});

export const edit = action<"GET", "/cms/roles/:id/edit">(async ({ db, params }) => {
	let role = await Role.findById(db, params.id);
	if (!role) return notFound("Not found");
	return ok(await renderForm(db, role, `Edit ${role.label}`));
});

export const update = action<"PUT", "/cms/roles/:id">(async ({ db, params, formData }) => {
	try {
		await Role.update(db, params.id, readForm(formData));
	} catch (error) {
		let role = await Role.findById(db, params.id);
		return badRequest(
			await renderForm(db, role ?? undefined, "Edit Role", String((error as Error).message)),
		);
	}
	return redirect("/cms/roles", { status: redirect.Status.SeeOther });
});

export const destroy = action<"DELETE", "/cms/roles/:id">(async ({ db, params }) => {
	try {
		await Role.destroy(db, params.id);
	} catch (error) {
		return badRequest(String((error as Error).message));
	}
	return redirect("/cms/roles", { status: redirect.Status.SeeOther });
});
