/**
 * Answers `GET /health` with an application/health+json report.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { health } from "~/app/initializers/health";
import routes from "~/routes/web";

/** Runs the health check and returns its response. */
export default createAction(routes.health, (ctx) => health.respond(ctx));
