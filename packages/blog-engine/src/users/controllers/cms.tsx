/**
 * The user management controller at `/cms/users`: list users, change a user's role,
 * and delete a user (reassigning or deleting their posts first). Gated by
 * `users.manage`; the last-admin invariant is enforced by the model layer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { redirect } from "@sdxc/http/response";
import { badRequest, notFound } from "@sdxc/http/response/html";
import * as ds from "remix/data-schema";
import { createController } from "remix/router";

import { getAuthUser, getPermissions } from "../../auth/middleware/auth.js";
import { requirePermission } from "../../auth/middleware/require-permission.js";
import { Post } from "../../posts/models/post.js";
import { Role } from "../../roles/models/role.js";
import routes from "../../routes.js";
import { Settings } from "../../settings/models/settings.js";
import { CmsLayout } from "../../shared/components/cms-layout.js";
import * as s from "../../shared/components/styles.js";
import { fieldText } from "../../shared/text.js";
import { User } from "../models/user.js";

async function chrome(db: Database) {
	let user = getAuthUser();
	let permissions = await getPermissions();
	let siteTitle = await Settings.siteTitle(db);
	return { user, permissions, siteTitle };
}

function label(user: { display_name: string; email: string } | null): string {
	return user ? user.display_name || user.email : "";
}

const RouteParams = ds.object({ id: ds.string() });

/** `/cms/users` — list users, change role, delete with reassignment (`users.manage`). */
export default createController(routes.cms.users, {
	middleware: [requirePermission("users.manage")],
	actions: {
		index: async (ctx) => {
			let [{ user, permissions, siteTitle }, users, roles] = await Promise.all([
				chrome(ctx.db),
				User.findAll(ctx.db),
				Role.findAll(ctx.db),
			]);
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

		edit: async (ctx) => {
			let { id } = ds.parse(RouteParams, ctx.params);
			let [{ user, permissions, siteTitle }, target, roles, users] = await Promise.all([
				chrome(ctx.db),
				User.findById(ctx.db, id),
				Role.findAll(ctx.db),
				User.findAll(ctx.db),
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
						<select
							mix={[s.selectControl]}
							id="role_id"
							name="role_id"
							defaultValue={target.role_id}
						>
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
						<select mix={[s.selectControl]} id="reassign_to" name="reassign_to">
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

		update: async (ctx) => {
			let { id } = ds.parse(RouteParams, ctx.params);
			let roleId = fieldText(ctx.formData, "role_id");
			try {
				await User.changeRole(ctx.db, id, roleId);
			} catch (error) {
				return badRequest(String((error as Error).message));
			}
			return redirect("/cms/users", { status: redirect.Status.SeeOther });
		},

		destroy: async (ctx) => {
			let { id } = ds.parse(RouteParams, ctx.params);
			let target = await User.findById(ctx.db, id);
			if (!target) return notFound("Not found");

			let postCount = await Post.countByAuthor(ctx.db, target.id);
			let reassignTo = fieldText(ctx.formData, "reassign_to").trim();
			try {
				if (postCount > 0) {
					if (reassignTo) await Post.reassignAuthor(ctx.db, target.id, reassignTo);
					else {
						let posts = await ctx.db.findMany(Post.table, { where: { author_id: target.id } });
						for (let post of posts) await Post.destroy(ctx.db, post.id);
					}
				}
				await User.destroy(ctx.db, target.id);
			} catch (error) {
				return badRequest(String((error as Error).message));
			}
			return redirect("/cms/users", { status: redirect.Status.SeeOther });
		},
	},
});
