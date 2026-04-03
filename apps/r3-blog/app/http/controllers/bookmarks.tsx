import action from "@pkg/remix-helpers/action";

import { db } from "~/app/http/middleware/db";
import { BookmarksViewModel } from "~/app/http/view-models/bookmarks";
import { view } from "~/app/infrastructure/view";
import { LikePost } from "~/app/repositories/posts/like";
import { BookmarksView } from "~/resources/views/bookmarks";
import routes from "~/routes/web";

export default action<typeof routes.bookmarks>(async () => {
	let bookmarks = await LikePost.findAll(db());
	let model = BookmarksViewModel.index(bookmarks);

	return view(BookmarksView, model);
});
