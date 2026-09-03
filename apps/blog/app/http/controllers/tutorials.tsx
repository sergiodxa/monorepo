/**
 * HTTP action for the public `/tutorials` index. Admin viewers also receive posts still
 * in preview. Data access stays in the repository layer so the controller projects
 * records through the view model and renders the listing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { isAdmin } from "~/app/http/middleware/auth";
import { TutorialsViewModel } from "~/app/http/view-models/tutorials";
import { TutorialPost } from "~/app/repositories/posts/tutorial";
import { TutorialsView } from "~/resources/views/tutorials";
import routes from "~/routes/web";

/**
 * Serves the public tutorials index as a server-rendered listing.
 * @returns HTML response for `GET /tutorials`.
 */
export default createAction(
	routes.tutorials,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let tutorials = await TutorialPost.listItems(db, {
			includePreview: isAdmin(),
		});
		let model = TutorialsViewModel.index(tutorials);

		return ctx.render(TutorialsView, model);
	}),
);
