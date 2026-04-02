import { ok } from "@pkg/http/response/html";
import action from "@pkg/remix-helpers/action";
import { renderToString } from "remix/component/server";

import { db } from "~/app/http/middleware/db";
import { ArticlePost } from "~/app/repositories/posts/article";
import { GlossaryPost } from "~/app/repositories/posts/glossary";
import { LikePost } from "~/app/repositories/posts/like";
import { TutorialPost } from "~/app/repositories/posts/tutorial";
import { CMSLayout } from "~/components/layout/cms";
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
