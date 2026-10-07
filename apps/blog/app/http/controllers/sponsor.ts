/**
 * HTTP action for the public `/sponsor` route. It redirects a stable on-site URL to the
 * `/sponsors` page, so sponsor links already shared reach every way to sponsor, GitHub
 * Sponsors and the one-off tips alike.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { createAction } from "remix/router";

import routes from "~/routes/web";

/**
 * Redirects the short public sponsor URL to the sponsors page.
 * @returns 303 redirect to `/sponsors`.
 */
export default createAction(routes.sponsor, async function sponsorAction() {
	return redirect(routes.sponsors.href(), { status: redirect.Status.SeeOther });
});
