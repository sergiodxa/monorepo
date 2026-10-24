/**
 * The app's health route, polled by uptime monitors and load balancers: `200` while every
 * critical dependency answers, `503` once one fails, with the report as
 * `application/health+json` naming which check is not passing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { health } from "~/app/initializers/health";
import routes from "~/routes/web";

/** GET /health — probes every binding and service the app depends on. */
export default createAction(routes.health, (ctx) => health.respond(ctx));
