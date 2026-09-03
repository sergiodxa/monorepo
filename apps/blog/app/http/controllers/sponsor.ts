/**
 * HTTP action for the public `/sponsor` route. It redirects a stable on-site URL to the
 * configured GitHub Sponsors profile, so shared sponsor links keep working when the
 * destination changes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { createAction } from "remix/router";

import { PROFILE } from "~/config/profile";
import routes from "~/routes/web";

/**
 * Redirects the short public sponsor URL to the configured GitHub Sponsors page.
 * @returns 303 redirect to the sponsor profile.
 */
export default createAction(routes.sponsor, async function sponsorAction() {
	return redirect(PROFILE.github.sponsor, { status: redirect.Status.SeeOther });
});
