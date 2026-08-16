/**
 * `/docs` controller. Has no page of its own: it redirects every visitor straight to
 * the overview doc, so the docs landing URL always resolves to a concrete starting
 * page instead of an index to pick from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { createAction } from "remix/router";

import routes from "~/routes/web";

/** GET /docs — redirects to the overview doc. */
export default createAction(routes.docs.index, () => {
	return redirect(routes.docs.show.href({ slug: "overview" }));
});
