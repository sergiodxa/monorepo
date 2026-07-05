import type { Database } from "remix/data-table";

import { redirect } from "@pkg/http/response";
import { badRequest, notFound, ok } from "@pkg/http/response/html";

import { PERMISSIONS, PERMISSION_KEYS, type Permission } from "../../../domain/permissions";
import { Role, type RoleInput, type RoleWithPermissions } from "../../../domain/role";
import { Settings } from "../../../domain/settings";
import action from "../../../shared/lib/action";
import { getAuthUser, getPermissions } from "../../../shared/middleware/auth";
import { cmsLayout } from "../../../views/cms-layout";
import { attr, escape } from "../../../views/html";

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

function form(role?: RoleWithPermissions, error?: string): string {
	let granted = new Set<Permission>(role?.permissions ?? []);
	let checks = PERMISSION_KEYS.map(
		(key) =>
			`<label><input type="checkbox" name="perm_${attr(key)}"${granted.has(key) ? " checked" : ""}${role?.builtin ? " disabled" : ""}> ` +
			`<code>${escape(key)}</code> — ${escape(PERMISSIONS[key])}</label>`,
	).join("");
	return (
		(error ? `<div class="notice">${escape(error)}</div>` : "") +
		`<form method="post">` +
		`<label for="name">Name (machine)</label><input type="text" id="name" name="name" value="${attr(role?.name ?? "")}"${role?.builtin ? " readonly" : ""}>` +
		`<label for="label">Label</label><input type="text" id="label" name="label" value="${attr(role?.label ?? "")}">` +
		`<label for="description">Description</label><input type="text" id="description" name="description" value="${attr(role?.description ?? "")}">` +
		`<fieldset><legend>Permissions</legend>${checks}</fieldset>` +
		(role?.builtin
			? `<p class="help">Built-in roles keep their permissions; only label/description can change.</p>`
			: "") +
		`<p><button type="submit">Save</button> <a class="btn secondary" href="/cms/roles">Cancel</a></p></form>`
	);
}

export const index = action<"GET", "/cms/roles">(async ({ db }) => {
	let { user, permissions, siteTitle } = await chrome(db);
	let roles = await Role.findAll(db);
	let rows = roles
		.map(
			(role) =>
				`<tr><td>${escape(role.label)}</td><td>${escape(role.name)}</td><td>${role.builtin ? "built-in" : "custom"}</td>` +
				`<td><a href="/cms/roles/${attr(role.id)}/edit">Edit</a></td></tr>`,
		)
		.join("");
	let body =
		`<p><a class="btn" href="/cms/roles/new">New role</a></p>` +
		`<table><thead><tr><th>Label</th><th>Name</th><th>Kind</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
	return ok(cmsLayout({ title: "Roles", siteTitle, userLabel: label(user), permissions, body }));
});

export const newRole = action<"GET", "/cms/roles/new">(async ({ db }) => {
	let { user, permissions, siteTitle } = await chrome(db);
	return ok(
		cmsLayout({ title: "New Role", siteTitle, userLabel: label(user), permissions, body: form() }),
	);
});

export const create = action<"POST", "/cms/roles">(async ({ db, formData }) => {
	let { user, permissions, siteTitle } = await chrome(db);
	try {
		await Role.create(db, readForm(formData));
	} catch (error) {
		return badRequest(
			cmsLayout({
				title: "New Role",
				siteTitle,
				userLabel: label(user),
				permissions,
				body: form(undefined, String((error as Error).message)),
			}),
		);
	}
	return redirect("/cms/roles", { status: redirect.Status.SeeOther });
});

export const edit = action<"GET", "/cms/roles/:id/edit">(async ({ db, params }) => {
	let { user, permissions, siteTitle } = await chrome(db);
	let role = await Role.findById(db, params.id);
	if (!role) return notFound("Not found");
	return ok(
		cmsLayout({
			title: `Edit ${role.label}`,
			siteTitle,
			userLabel: label(user),
			permissions,
			body: form(role),
		}),
	);
});

export const update = action<"PUT", "/cms/roles/:id">(async ({ db, params, formData }) => {
	let { user, permissions, siteTitle } = await chrome(db);
	try {
		await Role.update(db, params.id, readForm(formData));
	} catch (error) {
		let role = await Role.findById(db, params.id);
		return badRequest(
			cmsLayout({
				title: "Edit Role",
				siteTitle,
				userLabel: label(user),
				permissions,
				body: form(role ?? undefined, String((error as Error).message)),
			}),
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
