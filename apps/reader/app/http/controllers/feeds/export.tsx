/**
 * The subscription list as OPML.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { createAction } from "remix/router";

import requireUser from "~/app/http/middleware/require-user";
import routes from "~/routes/web";

export default createAction(routes.feeds.export, {
	middleware: [requireUser],
	handler: () => redirect(routes.feeds.index.href(), { status: redirect.Status.SeeOther }),
});
