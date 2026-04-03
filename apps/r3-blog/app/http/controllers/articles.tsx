import action from "@pkg/remix-helpers/action";

import { db } from "~/app/http/middleware/db";
import { ArticlesViewModel } from "~/app/http/view-models/articles";
import { view } from "~/app/infrastructure/view";
import { ArticlePost } from "~/app/repositories/posts/article";
import { ArticlesView } from "~/resources/views/articles";
import routes from "~/routes/web";

export default action<typeof routes.articles>(async () => {
	let articles = await ArticlePost.listItems(db());
	let model = ArticlesViewModel.index(articles);

	return view(ArticlesView, model);
});
