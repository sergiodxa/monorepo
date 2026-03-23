import { ok } from "@pkg/http/response/html";
import action from "@pkg/remix-helpers/action";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { CMSLayout } from "~/components/layout/cms";
import { db } from "~/middleware/db";
import { ArticlePost } from "~/models/posts/article";
import { GlossaryPost } from "~/models/posts/glossary";
import { LikePost } from "~/models/posts/like";
import { TutorialPost } from "~/models/posts/tutorial";
import { CMSDashboardView } from "~/views/cms/dashboard";

namespace CMSDashboardController {
	export interface ViewData {
		stats: CMSDashboardView.Stats;
		recentSearches: Array<string>;
	}
}

export default action<typeof routes.cms.dashboard>(async (ctx) => {
	let database = db(ctx);
	let [articles, tutorials, likes, glossary] = await Promise.all([
		ArticlePost.count(database),
		TutorialPost.count(database),
		LikePost.count(database),
		GlossaryPost.count(database),
	]);
	let viewData: CMSDashboardController.ViewData = {
		stats: {
			articles,
			likes,
			tutorials,
			glossary,
		},
		recentSearches: [],
	};

	let body = await renderToString(
		<CMSLayout title="Dashboard" activePath="/cms">
			<CMSDashboardView stats={viewData.stats} recentSearches={viewData.recentSearches} />
		</CMSLayout>,
	);

	return ok(body);
});
