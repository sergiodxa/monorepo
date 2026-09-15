/**
 * Takes every unread post out of the queue at once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { createAction } from "remix/router";

import requireUser from "~/app/http/middleware/require-user";
import routes from "~/routes/web";

export default createAction(routes.readAll, {
	middleware: [requireUser],
	handler: () => redirect(routes.reading.href(), { status: redirect.Status.SeeOther }),
});
