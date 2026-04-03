import action from "@pkg/remix-helpers/action";

import type routes from "~/routes/web";

import { db } from "~/app/http/middleware/db";
import { FeedViewModel } from "~/app/http/view-models/feed";
import { view } from "~/app/infrastructure/view";
import { Feed } from "~/app/repositories/feed";
import { FeedView } from "~/resources/views/feed";

export default action<typeof routes.feed>(async () => {
	let activity = await Feed.listActivity(db());
	let model = FeedViewModel.index(activity);

	return view(FeedView, model);
});
