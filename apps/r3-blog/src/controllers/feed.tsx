import { ok } from "@pkg/http/response/html";
import action from "@pkg/remix-helpers/action";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { BlogLayout } from "~/components/layout/blog";
import { db } from "~/middleware/db";
import { Feed } from "~/models/feed";
import { FeedView } from "~/views/feed";

export default action<typeof routes.feed>(async () => {
	let activity = await Feed.listActivity(db());

	let body = await renderToString(
		<BlogLayout title="Sergio Xalambrí" description="Sergio Xalambrí" activePath="/">
			<FeedView activity={activity} />
		</BlogLayout>,
	);

	return ok(body);
});
