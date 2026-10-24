/**
 * The health check uptime monitors poll. It answers an `application/health+json` report
 * naming each dependency's status, `200` while every critical one passes and `503`
 * otherwise, so an alert already says which dependency to look at.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { health } from "~/app/initializers/health";
import routes from "~/routes/web";

/** GET /health — probes every binding and service the server depends on. */
export default createAction(routes.health, (ctx) => health.respond(ctx));
