/**
 * HTTP action for the CMS dashboard. It resolves aggregate counts of articles, tutorials,
 * bookmarks, and glossary terms in parallel from the repository layer and renders the
 * dashboard view with those stats. It exists to give CMS operators an at-a-glance summary
 * of content volume on the backoffice landing page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";

import { ArticlePost } from "~/app/repositories/posts/article";
import { GlossaryPost } from "~/app/repositories/posts/glossary";
import { LikePost } from "~/app/repositories/posts/like";
import { TutorialPost } from "~/app/repositories/posts/tutorial";
import { CMSDashboardView } from "~/resources/views/cms/dashboard";

/**
 * The four content counters resolve in parallel, so the landing page costs a single round
 * of queries.
 * @param ctx Request-scoped dependency container used to resolve `Database`.
 * @returns HTML response for the dashboard with aggregate counters.
 */
export default inject([Database] as const, async function dashboard(database) {
	let ctx = getContext();
	let [articles, tutorials, likes, glossary] = await Promise.all([
		ArticlePost.count(database),
		TutorialPost.count(database),
		LikePost.count(database),
		GlossaryPost.count(database),
	]);

	return ctx.render(CMSDashboardView, { stats: { articles, likes, tutorials, glossary } });
});
