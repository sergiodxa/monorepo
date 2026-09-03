/**
 * The CMS dashboard controller at `/cms`: the admin home showing a per-type post
 * count table and quick links. Open to any authenticated user (anonymous requests
 * redirect to login).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { redirect } from "@sdxc/http/response";
import { inject } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { getAuthUser, getPermissions } from "../../auth/middleware/auth.js";
import { PostType } from "../../post-types/models/post-type.js";
import { Post } from "../../posts/models/post.js";
import routes from "../../routes.js";
import { Settings } from "../../settings/models/settings.js";
import { CmsLayout } from "../../shared/components/cms-layout.js";
import * as s from "../../shared/components/styles.js";

export default createAction(
	routes.cms.dashboard,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let user = getAuthUser();
		if (!user) {
			return redirect(routes.auth.login.index.href(), { status: redirect.Status.SeeOther });
		}
		let [permissions, siteTitle, types] = await Promise.all([
			getPermissions(),
			Settings.siteTitle(db),
			PostType.findAll(db),
		]);

		let rows = await Promise.all(
			types.map(async (type) => ({ type, count: await Post.count(db, type.name) })),
		);

		return ctx.render(
			<CmsLayout
				title="Dashboard"
				siteTitle={siteTitle}
				userLabel={user.display_name || user.email}
				permissions={permissions}
			>
				<p>Welcome, {user.display_name || user.email}.</p>
				<table mix={[s.table]}>
					<thead>
						<tr>
							<th mix={[s.cell]}>Post type</th>
							<th mix={[s.cell]}>Posts</th>
						</tr>
					</thead>
					<tbody>
						{rows.map(({ type, count }) => (
							<tr key={type.id}>
								<td mix={[s.cell]}>
									<a href={`/cms/types/${type.name}/posts`}>{type.label}</a>
								</td>
								<td mix={[s.cell]}>{count}</td>
							</tr>
						))}
					</tbody>
				</table>
			</CmsLayout>,
		);
	}),
);
