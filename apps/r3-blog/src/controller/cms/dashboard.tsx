import { ok } from "@pkg/http/response/html";
import action from "@pkg/remix-helpers/action";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { CMSDashboardPage } from "~/components/cms-pages";
import { db } from "~/middleware/db";
import { ArticlePost } from "~/models/posts/article";
import { GlossaryPost } from "~/models/posts/glossary";
import { LikePost } from "~/models/posts/like";
import { TutorialPost } from "~/models/posts/tutorial";

export default action<typeof routes.cms.dashboard>(async (ctx) => {
	let database = db(ctx);
	let [articles, tutorials, likes, glossary] = await Promise.all([
		ArticlePost.count(database),
		TutorialPost.count(database),
		LikePost.count(database),
		GlossaryPost.count(database),
	]);

	let body = await renderToString(
		<CMSDashboardPage
			stats={{
				articles,
				likes,
				tutorials,
				glossary,
			}}
			recentSearches={[]}
		/>,
	);

	return ok(body);
});
