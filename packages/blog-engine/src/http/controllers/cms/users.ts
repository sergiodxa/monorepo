import type { Database } from "remix/data-table";

import { redirect } from "@pkg/http/response";
import { badRequest, notFound, ok } from "@pkg/http/response/html";

import { Post } from "../../../domain/post";
import { Role } from "../../../domain/role";
import { Settings } from "../../../domain/settings";
import { User } from "../../../domain/user";
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

export const index = action<"GET", "/cms/users">(async ({ db }) => {
	let { user, permissions, siteTitle } = await chrome(db);
	let [users, roles] = await Promise.all([User.findAll(db), Role.findAll(db)]);
	let roleName = new Map(roles.map((role) => [role.id, role.label]));

	let rows = users
		.map(
			(row) =>
				`<tr><td>${escape(row.display_name || row.email)}</td><td>${escape(row.email)}</td>` +
				`<td>${escape(roleName.get(row.role_id) ?? "—")}</td>` +
				`<td><a href="/cms/users/${attr(row.id)}/edit">Edit</a></td></tr>`,
		)
		.join("");

	return ok(
		cmsLayout({
			title: "Users",
			siteTitle,
			userLabel: label(user),
			permissions,
			body: `<table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead><tbody>${rows}</tbody></table>`,
		}),
	);
});

export const edit = action<"GET", "/cms/users/:id/edit">(async ({ db, params }) => {
	let { user, permissions, siteTitle } = await chrome(db);
	let [target, roles, users] = await Promise.all([
		User.findById(db, params.id),
		Role.findAll(db),
		User.findAll(db),
	]);
	if (!target) return notFound("Not found");

	let roleOptions = roles
		.map(
			(role) =>
				`<option value="${attr(role.id)}"${role.id === target.role_id ? " selected" : ""}>${escape(role.label)}</option>`,
		)
		.join("");
	let reassignOptions = users
		.filter((candidate) => candidate.id !== target.id)
		.map(
			(candidate) =>
				`<option value="${attr(candidate.id)}">${escape(candidate.display_name || candidate.email)}</option>`,
		)
		.join("");

	let body =
		`<form method="post" action="/cms/users/${attr(target.id)}"><input type="hidden" name="_method" value="PUT">` +
		`<label for="role_id">Role</label><select id="role_id" name="role_id">${roleOptions}</select>` +
		`<p><button type="submit">Save role</button></p></form>` +
		`<hr><h3>Delete user</h3>` +
		`<form method="post" action="/cms/users/${attr(target.id)}"><input type="hidden" name="_method" value="DELETE">` +
		`<label for="reassign_to">Reassign this user's posts to</label>` +
		`<select id="reassign_to" name="reassign_to"><option value="">— delete their posts —</option>${reassignOptions}</select>` +
		`<p><button type="submit" class="danger">Delete user</button></p></form>`;

	return ok(
		cmsLayout({ title: "Edit user", siteTitle, userLabel: label(user), permissions, body }),
	);
});

export const update = action<"PUT", "/cms/users/:id">(async ({ db, params, formData }) => {
	let roleId = String(formData.get("role_id") ?? "");
	try {
		await User.changeRole(db, params.id, roleId);
	} catch (error) {
		return badRequest(String((error as Error).message));
	}
	return redirect("/cms/users", { status: redirect.Status.SeeOther });
});

export const destroy = action<"DELETE", "/cms/users/:id">(async ({ db, params, formData }) => {
	let target = await User.findById(db, params.id);
	if (!target) return notFound("Not found");

	let postCount = await Post.countByAuthor(db, target.id);
	let reassignTo = String(formData.get("reassign_to") ?? "").trim();
	try {
		if (postCount > 0) {
			if (reassignTo) await Post.reassignAuthor(db, target.id, reassignTo);
			else {
				let posts = await db.findMany(Post.table, { where: { author_id: target.id } });
				for (let post of posts) await Post.destroy(db, post.id);
			}
		}
		await User.destroy(db, target.id);
	} catch (error) {
		return badRequest(String((error as Error).message));
	}
	return redirect("/cms/users", { status: redirect.Status.SeeOther });
});
