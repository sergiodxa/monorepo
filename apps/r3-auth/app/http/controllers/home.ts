/**
 * The site root. This server exists to answer authorization requests, so a visit to
 * `/` is sent to `/authorize`, which either signs the visitor in to their own account
 * area or shows them the sign-in page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { createAction } from "remix/router";

import routes from "~/routes/web";

/** GET / — redirects to the authorization endpoint. */
export default createAction(routes.home, () => {
	return redirect(routes.authorize.index.href(), { status: redirect.Status.SeeOther });
});
