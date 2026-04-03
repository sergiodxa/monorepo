import action from "@pkg/remix-helpers/action";
import { Database } from "remix/data-table";

import { view } from "~/app/infrastructure/view";
import { ArticlePost } from "~/app/repositories/posts/article";
import { GlossaryPost } from "~/app/repositories/posts/glossary";
import { LikePost } from "~/app/repositories/posts/like";
import { TutorialPost } from "~/app/repositories/posts/tutorial";
import { CMSDashboardView } from "~/resources/views/cms/dashboard";
import routes from "~/routes/web";

/**
 * Handles the CMS dashboard route by resolving aggregate counters for each
 * supported content type and rendering the dashboard summary cards.
 */
export default action<typeof routes.cms.dashboard>(
	/**
	 * Resolves dashboard metrics from repository models and returns the server-rendered
	 * CMS dashboard response.
	 *
	 * Contract: all counts are fetched from the same request-scoped database instance
	 * and returned as plain numbers in `stats` for `CMSDashboardView`.
	 *
	 * Non-obvious behavior: `Promise.all` runs independent count queries concurrently
	 * so dashboard latency is bounded by the slowest count query instead of sum of all.
	 * @param ctx Request-scoped dependency container used to resolve `Database`.
	 * @returns HTML response for the dashboard with `stats.articles`, `stats.tutorials`,
	 * `stats.likes`, and `stats.glossary` numeric counters.
	 */
	async (ctx) => {
		let database = ctx.get(Database);
		let [articles, tutorials, likes, glossary] = await Promise.all([
			ArticlePost.count(database),
			TutorialPost.count(database),
			LikePost.count(database),
			GlossaryPost.count(database),
		]);

		return view(CMSDashboardView, { stats: { articles, likes, tutorials, glossary } });
	},
);
