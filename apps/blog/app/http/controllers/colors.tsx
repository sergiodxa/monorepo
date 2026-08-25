/**
 * HTTP action for the public `/colors` route. The page renders from static tokens alone,
 * so the response is deterministic; it serves as the catalog used to audit and preview
 * the site's semantic color tokens.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { ColorsView } from "~/resources/views/colors";
import routes from "~/routes/web";

/**
 * Serves the design-token reference page used to audit and preview semantic colors.
 * @returns HTML response for the public `/colors` catalog.
 */
export default createAction(routes.colors, async (ctx) => {
	let model: ColorsView.Model = {};

	return ctx.render(ColorsView, model);
});
