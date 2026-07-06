/**
 * HTTP action for the public `/sponsor` route. It issues a temporary redirect from the
 * stable on-site sponsor URL to the configured GitHub Sponsors profile. It exists so the
 * site can advertise a permanent sponsor link while the actual destination can change
 * later without breaking shared URLs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { createAction } from "remix/fetch-router";

import { PROFILE } from "~/config/profile";
import routes from "~/routes/web";

/**
 * Redirects the short public sponsor URL to Sergio's GitHub Sponsors page.
 */
export default createAction(
	routes.sponsor,
	/**
	 * Preserves a stable on-site sponsor URL while allowing the destination flow to change later.
	 *
	 * @returns Temporary redirect to the current GitHub Sponsors profile.
	 */
	async function sponsorAction() {
		return redirect(PROFILE.github.sponsor, { status: redirect.Status.SeeOther });
	},
);
