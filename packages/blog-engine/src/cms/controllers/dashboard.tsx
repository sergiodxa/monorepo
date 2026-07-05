import { ok } from "@pkg/http/response/html";

import { getAuthUser, getPermissions } from "../../auth/middleware/auth";
import { PostType } from "../../post-types/models/post-type";
import { Post } from "../../posts/models/post";
import { Settings } from "../../settings/models/settings";
import { CmsLayout } from "../../shared/components/cms-layout";
import action from "../../shared/lib/action";
import { renderDocument } from "../../shared/lib/render";

/** CMS home: post counts per type + quick links. */
export default action<"GET", "/cms">(async ({ db }) => {
	let user = await getAuthUser();
	let permissions = await getPermissions();
	let siteTitle = await Settings.siteTitle(db);
	let types = await PostType.findAll(db);

	let rows = await Promise.all(
		types.map(async (type) => ({ type, count: await Post.count(db, type.name) })),
	);

	let body = await renderDocument(
		<CmsLayout
			title="Dashboard"
			siteTitle={siteTitle}
			userLabel={user ? user.display_name || user.email : ""}
			permissions={permissions}
		>
			<p>Welcome{user ? `, ${user.display_name || user.email}` : ""}.</p>
			<table>
				<thead>
					<tr>
						<th>Post type</th>
						<th>Posts</th>
					</tr>
				</thead>
				<tbody>
					{rows.map(({ type, count }) => (
						<tr key={type.id}>
							<td>
								<a href={`/cms/types/${type.name}/posts`}>{type.label}</a>
							</td>
							<td>{count}</td>
						</tr>
					))}
				</tbody>
			</table>
		</CmsLayout>,
	);
	return ok(body);
});
