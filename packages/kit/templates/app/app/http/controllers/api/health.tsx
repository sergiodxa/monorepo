/**
 * The health check: it answers as soon as the Worker runs, so a monitor tells a deploy that
 * serves from one that fails to start.
 */

import { createAction } from "remix/router";

import api from "~/app/http/middleware/api";
import routes from "~/routes/api";

export default createAction(routes.api.health, {
	middleware: api,
	/** GET /api/health, answered as the `health` operation documents it. */
	handler: () => Response.json({ status: "ok" }),
});
