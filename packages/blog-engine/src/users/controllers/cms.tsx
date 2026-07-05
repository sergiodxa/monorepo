import type { Database } from "remix/data-table";

import { redirect } from "@pkg/http/response";
import { badRequest, notFound } from "@pkg/http/response/html";
import { createController } from "remix/fetch-router";

import { getAuthUser, getPermissions } from "../../auth/middleware/auth";
import { requirePermission } from "../../auth/middleware/require-permission";
import { Post } from "../../posts/models/post";
import { Role } from "../../roles/models/role";
import routes from "../../routes";
import { Settings } from "../../settings/models/settings";
import { CmsLayout } from "../../shared/components/cms-layout";
import * as s from "../../shared/components/styles";
import { User } from "../models/user";

async function chrome(db: Database) {
	let user = await getAuthUser();
	let permissions = await getPermissions();
	let siteTitle = await Settings.siteTitle(db);
	return { user, permissions, siteTitle };
}

function label(user: { display_name: string; email: string } | null): string {
	return user ? user.display_name || user.email : "";
}

/** `/cms/users` — list users, change role, delete with reassignment (`users.manage`). */
export default createController(routes.cms.users, {
	middleware: [requirePermission("users.manage")],
	actions: {
		async index(ctx) {
			let { db } = ctx;
			let { user, permissions, siteTitle } = await chrome(db);
			let [users, roles] = await Promise.all([User.findAll(db), Role.findAll(db)]);
			let roleName = new Map(roles.map((role) => [role.id, role.label]));

			return ctx.render(
				<CmsLayout
					title="Users"
					siteTitle={siteTitle}
					userLabel={label(user)}
					permissions={permissions}
				>
					<table mix={[s.table]}>
						<thead>
							<tr>
								<th mix={[s.cell]}>Name</th>
								<th mix={[s.cell]}>Email</th>
								<th mix={[s.cell]}>Role</th>
								<th mix={[s.cell]} />
							</tr>
						</thead>
						<tbody>
							{users.map((row) => (
								<tr key={row.id}>
									<td mix={[s.cell]}>{row.display_name || row.email}</td>
									<td mix={[s.cell]}>{row.email}</td>
									<td mix={[s.cell]}>{roleName.get(row.role_id) ?? "—"}</td>
									<td mix={[s.cell]}>
										<a href={`/cms/users/${row.id}/edit`}>Edit</a>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</CmsLayout>,
			);
		},

		async edit(ctx) {
			let { db, params } = ctx;
			let { user, permissions, siteTitle } = await chrome(db);
			let [target, roles, users] = await Promise.all([
				User.findById(db, params.id),
				Role.findAll(db),
				User.findAll(db),
			]);
			if (!target) return notFound("Not found");

			let others = users.filter((candidate) => candidate.id !== target.id);
			return ctx.render(
				<CmsLayout
					title="Edit user"
					siteTitle={siteTitle}
					userLabel={label(user)}
					permissions={permissions}
				>
					<form method="post" action={`/cms/users/${target.id}`}>
						<input type="hidden" name="_method" value="PUT" />
						<label mix={[s.label]} htmlFor="role_id">
							Role
						</label>
						<select mix={[s.control]} id="role_id" name="role_id" defaultValue={target.role_id}>
							{roles.map((role) => (
								<option value={role.id} key={role.id}>
									{role.label}
								</option>
							))}
						</select>
						<p>
							<button mix={[s.button]} type="submit">
								Save role
							</button>
						</p>
					</form>
					<hr />
					<h3>Delete user</h3>
					<form method="post" action={`/cms/users/${target.id}`}>
						<input type="hidden" name="_method" value="DELETE" />
						<label mix={[s.label]} htmlFor="reassign_to">
							Reassign this user's posts to
						</label>
						<select mix={[s.control]} id="reassign_to" name="reassign_to">
							<option value="">— delete their posts —</option>
							{others.map((candidate) => (
								<option value={candidate.id} key={candidate.id}>
									{candidate.display_name || candidate.email}
								</option>
							))}
						</select>
						<p>
							<button mix={[s.button, s.buttonDanger]} type="submit">
								Delete user
							</button>
						</p>
					</form>
				</CmsLayout>,
			);
		},

		async update(ctx) {
			let roleId = String(ctx.formData.get("role_id") ?? "");
			try {
				await User.changeRole(ctx.db, ctx.params.id, roleId);
			} catch (error) {
				return badRequest(String((error as Error).message));
			}
			return redirect("/cms/users", { status: redirect.Status.SeeOther });
		},

		async destroy(ctx) {
			let { db, params, formData } = ctx;
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
		},
	},
});
