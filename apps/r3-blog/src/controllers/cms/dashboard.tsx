import { ok } from "@pkg/http/response/html";
import action from "@pkg/remix-helpers/action";
import { renderToString } from "remix/component/server";

import { CMSLayout } from "~/components/layout/cms";
import { db } from "~/middleware/db";
import { ArticlePost } from "~/models/posts/article";
import { GlossaryPost } from "~/models/posts/glossary";
import { LikePost } from "~/models/posts/like";
import { TutorialPost } from "~/models/posts/tutorial";
import routes from "~/routes";
import { CMSDashboardView } from "~/views/cms/dashboard";

export default action<typeof routes.cms.dashboard>(async () => {
	let database = db();
	let [articles, tutorials, likes, glossary] = await Promise.all([
		ArticlePost.count(database),
		TutorialPost.count(database),
		LikePost.count(database),
		GlossaryPost.count(database),
	]);

	let body = await renderToString(
		<CMSLayout title="Dashboard" activePath={routes.cms.dashboard.href()}>
			<CMSDashboardView stats={{ articles, likes, tutorials, glossary }} />
		</CMSLayout>,
	);

	return ok(body);
});
