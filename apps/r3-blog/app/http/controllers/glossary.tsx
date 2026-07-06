/**
 * HTTP action for the public `/glossary` index. It resolves all glossary entries from the
 * database, projects them through the glossary view model, and renders the glossary HTML
 * view. It exists to serve the server-rendered glossary listing while keeping data access
 * in the repository layer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import { GlossaryViewModel } from "~/app/http/view-models/glossary";
import { GlossaryPost } from "~/app/repositories/posts/glossary";
import { GlossaryView } from "~/resources/views/glossary";
import routes from "~/routes/web";

/**
 * Serves the public glossary index page.
 *
 * Contract: resolves all glossary entries from the app database and returns an SSR HTML response.
 * @returns HTML response for the glossary route.
 */
export default createAction(
	routes.glossary,
	/**
	 * Handles glossary route requests using route-scoped dependencies.
	 * @param ctx Request context that provides dependency resolution for data access.
	 * @returns HTML response built from glossary records projected into the glossary view model.
	 */
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let glossary = await GlossaryPost.findAll(db);
		let model = GlossaryViewModel.index(glossary);

		return ctx.render(GlossaryView, model);
	}),
);
