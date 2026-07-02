import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";

import { ArticlePost } from "~/app/repositories/posts/article";
import { GlossaryPost } from "~/app/repositories/posts/glossary";
import { LikePost } from "~/app/repositories/posts/like";
import { TutorialPost } from "~/app/repositories/posts/tutorial";
import { CMSDashboardView } from "~/resources/views/cms/dashboard";

/**
 * Resolves dashboard metrics from repository models and returns the server-rendered
 * CMS dashboard response.
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
