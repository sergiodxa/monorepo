import action from "@pkg/remix-helpers/action";
import { Database } from "remix/data-table";

import { BookmarksViewModel } from "~/app/http/view-models/bookmarks";
import { view } from "~/app/infrastructure/view";
import { LikePost } from "~/app/repositories/posts/like";
import { BookmarksView } from "~/resources/views/bookmarks";
import routes from "~/routes/web";

export default action<typeof routes.bookmarks>(async (ctx) => {
	let bookmarks = await LikePost.findAll(ctx.get(Database));
	let model = BookmarksViewModel.index(bookmarks);

	return view(BookmarksView, model);
});
