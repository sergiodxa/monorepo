/**
 * HTTP action for the public `/tutorials` index. It loads tutorial list items from the
 * database (including preview posts when the viewer is an admin), maps them through the
 * tutorials view model, and renders the tutorials HTML view. It exists to project
 * persisted tutorial records into a server-rendered listing page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { isAdmin } from "~/app/http/middleware/auth";
import { TutorialsViewModel } from "~/app/http/view-models/tutorials";
import { TutorialPost } from "~/app/repositories/posts/tutorial";
import { TutorialsView } from "~/resources/views/tutorials";
import routes from "~/routes/web";

/**
 * Serves the public tutorials listing page.
 *
 * Contract: fetch persisted tutorial records through the model layer, project them
 * into the tutorials page view model, and render an SSR HTML response.
 * @example // GET /tutorials
 */
export default createAction(
	routes.tutorials,
	/**
	 * Resolves dependencies from the route context and prepares view data.
	 * @param ctx - Route context that provides app-scoped services.
	 * @returns SSR response for the tutorials index route.
	 */
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let tutorials = await TutorialPost.listItems(db, {
			includePreview: isAdmin(),
		});
		let model = TutorialsViewModel.index(tutorials);

		return ctx.render(TutorialsView, model);
	}),
);
