import action from "@pkg/remix-helpers/action";

import { view } from "~/app/infrastructure/view";
import { ColorsView } from "~/resources/views/colors";
import routes from "~/routes/web";

/**
 * Serves the design-token reference page used to audit and preview semantic color values.
 *
 * Contract: always returns an HTML document generated from `ColorsView`.
 *
 * @returns HTML response for the public `/colors` catalog.
 */
export default action<typeof routes.colors>(
	/**
	 * Builds the minimal view model required by `ColorsView` for static token rendering.
	 *
	 * Contract: performs no I/O and keeps the route payload deterministic.
	 *
	 * @returns HTML response containing the token documentation UI.
	 */
	async () => {
		let model: ColorsView.Model = {};

		return view(ColorsView, model);
	},
);
