import action from "@pkg/remix-helpers/action";

import { db } from "~/app/http/middleware/db";
import { view } from "~/app/infrastructure/view";
import { ArticlePost } from "~/app/repositories/posts/article";
import { GlossaryPost } from "~/app/repositories/posts/glossary";
import { LikePost } from "~/app/repositories/posts/like";
import { TutorialPost } from "~/app/repositories/posts/tutorial";
import { CMSDashboardView } from "~/resources/views/cms/dashboard";
import routes from "~/routes/web";

export default action<typeof routes.cms.dashboard>(async () => {
	let database = db();
	let [articles, tutorials, likes, glossary] = await Promise.all([
		ArticlePost.count(database),
		TutorialPost.count(database),
		LikePost.count(database),
		GlossaryPost.count(database),
	]);

	return view(CMSDashboardView, { stats: { articles, likes, tutorials, glossary } });
});
