import action from "@pkg/remix-helpers/action";
import { Database } from "remix/data-table";

import { GlossaryViewModel } from "~/app/http/view-models/glossary";
import { view } from "~/app/infrastructure/view";
import { GlossaryPost } from "~/app/repositories/posts/glossary";
import { GlossaryView } from "~/resources/views/glossary";
import routes from "~/routes/web";

/**
 * Serves the public glossary index page.
 *
 * Contract: resolves all glossary entries from the app database and returns an SSR HTML response.
 * @returns HTML response for the glossary route.
 */
export default action<typeof routes.glossary>(
	/**
	 * Handles glossary route requests using route-scoped dependencies.
	 * @param ctx Request context that provides dependency resolution for data access.
	 * @returns HTML response built from glossary records projected into the glossary view model.
	 */
	async (ctx) => {
		let glossary = await GlossaryPost.findAll(ctx.get(Database));
		let model = GlossaryViewModel.index(glossary);

		return view(GlossaryView, model);
	},
);
