/**
 * HTTP action for the public `/glossary` index. Data access stays in the repository
 * layer, so the controller projects glossary entries through the view model and renders
 * the listing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { GlossaryViewModel } from "~/app/http/view-models/glossary";
import { GlossaryPost } from "~/app/repositories/posts/glossary";
import { GlossaryView } from "~/resources/views/glossary";
import routes from "~/routes/web";

/**
 * Serves the public glossary index with every persisted glossary entry.
 * @returns HTML response for the glossary route.
 */
export default createAction(
	routes.glossary,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let glossary = await GlossaryPost.findAll(db);
		let model = GlossaryViewModel.index(glossary);

		return ctx.render(GlossaryView, model);
	}),
);
