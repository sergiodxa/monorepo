import action from "@pkg/remix-helpers/action";
import { Database } from "remix/data-table";

import type routes from "~/routes/web";

import { FeedViewModel } from "~/app/http/view-models/feed";
import { view } from "~/app/infrastructure/view";
import { Feed } from "~/app/repositories/feed";
import { FeedView } from "~/resources/views/feed";

export default action<typeof routes.feed>(async (ctx) => {
	let activity = await Feed.listActivity(ctx.get(Database));
	let model = FeedViewModel.index(activity);

	return view(FeedView, model);
});
