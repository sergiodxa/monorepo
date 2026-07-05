import { redirect } from "@pkg/http/response";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import { getAuthUser, getPermissions } from "../../auth/middleware/auth";
import { PostType } from "../../post-types/models/post-type";
import { Post } from "../../posts/models/post";
import routes from "../../routes";
import { Settings } from "../../settings/models/settings";
import { CmsLayout } from "../../shared/components/cms-layout";
import * as s from "../../shared/components/styles";

/** CMS home: post counts per type + quick links (any authenticated user). */
export default createAction(
	routes.cms.dashboard,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let user = await getAuthUser();
		if (!user) {
			return redirect(routes.auth.login.index.href(), { status: redirect.Status.SeeOther });
		}
		let permissions = await getPermissions();
		let siteTitle = await Settings.siteTitle(db);
		let types = await PostType.findAll(db);

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
