/**
 * HTTP action for the public `/colors` route. It renders the design-token reference page
 * from `ColorsView` with an empty, deterministic model and performs no I/O. It exists as
 * a static catalog used to audit and preview the site's semantic color tokens.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { ColorsView } from "~/resources/views/colors";
import routes from "~/routes/web";

/**
 * Serves the design-token reference page used to audit and preview semantic color values.
 *
 * Contract: always returns an HTML document generated from `ColorsView`.
 *
 * @returns HTML response for the public `/colors` catalog.
 */
export default createAction(
	routes.colors,
	/**
	 * Builds the minimal view model required by `ColorsView` for static token rendering.
	 *
	 * Contract: performs no I/O and keeps the route payload deterministic.
	 *
	 * @returns HTML response containing the token documentation UI.
	 */
	async (ctx) => {
		let model: ColorsView.Model = {};

		return ctx.render(ColorsView, model);
	},
);
