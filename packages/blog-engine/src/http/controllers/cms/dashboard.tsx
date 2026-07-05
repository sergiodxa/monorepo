import { ok } from "@pkg/http/response/html";

import { Post } from "../../../domain/post";
import { PostType } from "../../../domain/post-type";
import { Settings } from "../../../domain/settings";
import action from "../../../shared/lib/action";
import { renderDocument } from "../../../shared/lib/render";
import { getAuthUser, getPermissions } from "../../../shared/middleware/auth";
import { CmsLayout } from "../../../views/cms-layout";

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
