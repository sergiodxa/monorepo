/**
 * Posts matching what the reader typed, across every feed they follow.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { createAction } from "remix/router";

import requireUser from "~/app/http/middleware/require-user";
import routes from "~/routes/web";

export default createAction(routes.search, {
	middleware: [requireUser],
	handler: () => redirect(routes.reading.href(), { status: redirect.Status.SeeOther }),
});
