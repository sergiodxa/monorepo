import action from "@pkg/remix-helpers/action";
import { Database } from "remix/data-table";

import { isAdmin } from "~/app/http/middleware/auth";
import { TutorialsViewModel } from "~/app/http/view-models/tutorials";
import { view } from "~/app/infrastructure/view";
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
export default action<typeof routes.tutorials>(
	/**
	 * Resolves dependencies from the route context and prepares view data.
	 * @param ctx - Route context that provides app-scoped services.
	 * @returns SSR response for the tutorials index route.
	 */
	async (ctx) => {
		let tutorials = await TutorialPost.listItems(ctx.get(Database), {
			includePreview: isAdmin(),
		});
		let model = TutorialsViewModel.index(tutorials);

		return view(TutorialsView, model);
	},
);
