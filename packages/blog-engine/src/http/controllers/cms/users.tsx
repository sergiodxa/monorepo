import type { Database } from "remix/data-table";

import { redirect } from "@pkg/http/response";
import { badRequest, notFound, ok } from "@pkg/http/response/html";

import { Post } from "../../../domain/post";
import { Role } from "../../../domain/role";
import { Settings } from "../../../domain/settings";
import { User } from "../../../domain/user";
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

export const index = action<"GET", "/cms/users">(async ({ db }) => {
	let { user, permissions, siteTitle } = await chrome(db);
	let [users, roles] = await Promise.all([User.findAll(db), Role.findAll(db)]);
	let roleName = new Map(roles.map((role) => [role.id, role.label]));

	let body = await renderDocument(
		<CmsLayout
			title="Users"
			siteTitle={siteTitle}
			userLabel={label(user)}
			permissions={permissions}
		>
			<table>
				<thead>
					<tr>
						<th>Name</th>
						<th>Email</th>
						<th>Role</th>
						<th />
					</tr>
				</thead>
				<tbody>
					{users.map((row) => (
						<tr key={row.id}>
							<td>{row.display_name || row.email}</td>
							<td>{row.email}</td>
							<td>{roleName.get(row.role_id) ?? "—"}</td>
							<td>
								<a href={`/cms/users/${row.id}/edit`}>Edit</a>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</CmsLayout>,
	);
	return ok(body);
});

export const edit = action<"GET", "/cms/users/:id/edit">(async ({ db, params }) => {
	let { user, permissions, siteTitle } = await chrome(db);
	let [target, roles, users] = await Promise.all([
		User.findById(db, params.id),
		Role.findAll(db),
		User.findAll(db),
	]);
	if (!target) return notFound("Not found");

	let others = users.filter((candidate) => candidate.id !== target.id);
	let body = await renderDocument(
		<CmsLayout
			title="Edit user"
			siteTitle={siteTitle}
			userLabel={label(user)}
			permissions={permissions}
		>
			<form method="post" action={`/cms/users/${target.id}`}>
				<input type="hidden" name="_method" value="PUT" />
				<label htmlFor="role_id">Role</label>
				<select id="role_id" name="role_id" defaultValue={target.role_id}>
					{roles.map((role) => (
						<option value={role.id} key={role.id}>
							{role.label}
						</option>
					))}
				</select>
				<p>
					<button type="submit">Save role</button>
				</p>
			</form>
			<hr />
			<h3>Delete user</h3>
			<form method="post" action={`/cms/users/${target.id}`}>
				<input type="hidden" name="_method" value="DELETE" />
				<label htmlFor="reassign_to">Reassign this user's posts to</label>
				<select id="reassign_to" name="reassign_to">
					<option value="">— delete their posts —</option>
					{others.map((candidate) => (
						<option value={candidate.id} key={candidate.id}>
							{candidate.display_name || candidate.email}
						</option>
					))}
				</select>
				<p>
					<button type="submit" class="danger">
						Delete user
					</button>
				</p>
			</form>
		</CmsLayout>,
	);
	return ok(body);
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
