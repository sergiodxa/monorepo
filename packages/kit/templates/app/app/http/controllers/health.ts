/**
 * The health check: every dependency the app reads, probed on each request, so a monitor tells
 * a deploy that serves from one whose database is unreachable.
 */

import { createAction } from "remix/router";

import api from "~/app/http/middleware/api";
import { health } from "~/app/initializers/health";
import routes from "~/routes/api";

export default createAction(routes.health, {
	middleware: api,
	/** GET /health, `200` while every critical probe passes and `503` once one fails. */
	handler: (ctx) => health.respond(ctx),
});
