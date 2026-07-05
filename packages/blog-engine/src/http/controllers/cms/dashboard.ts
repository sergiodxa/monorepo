import { ok } from "@pkg/http/response/html";

import { Post } from "../../../domain/post";
import { PostType } from "../../../domain/post-type";
import { Settings } from "../../../domain/settings";
import action from "../../../shared/lib/action";
import { getAuthUser, getPermissions } from "../../../shared/middleware/auth";
import { cmsLayout } from "../../../views/cms-layout";
import { attr, escape } from "../../../views/html";

/** CMS home: post counts per type + quick links. */
export default action<"GET", "/cms">(async ({ db }) => {
	let user = await getAuthUser();
	let permissions = await getPermissions();
	let siteTitle = await Settings.siteTitle(db);
	let types = await PostType.findAll(db);

	let rows = await Promise.all(
		types.map(async (type) => {
			let count = await Post.count(db, type.name);
			return `<tr><td><a href="/cms/types/${attr(type.name)}/posts">${escape(type.label)}</a></td><td>${count}</td></tr>`;
		}),
	);

	let body =
		`<p>Welcome${user ? `, ${escape(user.display_name || user.email)}` : ""}.</p>` +
		`<table><thead><tr><th>Post type</th><th>Posts</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;

	return ok(
		cmsLayout({
			title: "Dashboard",
			siteTitle,
			userLabel: user ? user.display_name || user.email : "",
			permissions,
			body,
		}),
	);
});
