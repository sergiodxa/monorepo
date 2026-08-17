/**
 * The user management controller at `/cms/users`: list users, change a user's role,
 * and delete a user (reassigning or deleting their posts first). Gated by
 * `users.manage`; the last-admin invariant is enforced by the model layer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { badRequest, notFound } from "@pkg/http/response/html";
import { inject } from "@pkg/service-container";
import * as ds from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

import { getAuthUser, getPermissions } from "../../auth/middleware/auth";
import { requirePermission } from "../../auth/middleware/require-permission";
import { Post } from "../../posts/models/post";
import { Role } from "../../roles/models/role";
import routes from "../../routes";
import { Settings } from "../../settings/models/settings";
import { CmsLayout } from "../../shared/components/cms-layout";
import * as s from "../../shared/components/styles";
import { fieldText } from "../../shared/text";
import { User } from "../models/user";

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

/** Route params identifying the user being managed (`:id`). */
const RouteParams = ds.object({ id: ds.string() });

/** `/cms/users` — list users, change role, delete with reassignment (`users.manage`). */
export default createController(routes.cms.users, {
	middleware: [requirePermission("users.manage")],
	actions: {
		index: inject([Database] as const, async (db) => {
			let ctx = getContext();
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
		}),

		edit: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let { id } = ds.parse(RouteParams, ctx.params);
			let { user, permissions, siteTitle } = await chrome(db);
			let [target, roles, users] = await Promise.all([
				User.findById(db, id),
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
		}),

		update: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let { id } = ds.parse(RouteParams, ctx.params);
			let roleId = fieldText(ctx.formData, "role_id");
			try {
				await User.changeRole(db, id, roleId);
			} catch (error) {
				return badRequest(String((error as Error).message));
			}
			return redirect("/cms/users", { status: redirect.Status.SeeOther });
		}),

		destroy: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let { id } = ds.parse(RouteParams, ctx.params);
			let target = await User.findById(db, id);
			if (!target) return notFound("Not found");

			let postCount = await Post.countByAuthor(db, target.id);
			let reassignTo = fieldText(ctx.formData, "reassign_to").trim();
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
		}),
	},
});
