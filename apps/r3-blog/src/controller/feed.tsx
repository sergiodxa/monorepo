import { ok } from "@pkg/http/response/html";
import action from "@pkg/remix-helpers/action";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { FeedPage } from "~/components/pages";
import { db } from "~/middleware/db";
import { Feed } from "~/models/feed";

export default action<typeof routes.feed>(async (ctx) => {
	let activity = await Feed.listActivity(db(ctx));
	let body = await renderToString(<FeedPage activity={activity} />);
	return ok(body);
});
