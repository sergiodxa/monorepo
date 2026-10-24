/**
 * `GET /health` on the platform host: the dependency report uptime monitors and load
 * balancers read, as `application/health+json`, `503` once a critical dependency fails.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { health } from "~/app/initializers/health";
import routes from "~/routes/web";

/**
 * Probes every dependency in parallel and answers with their report: `200` while each passes
 * or only Polar fails, `503` when a critical one fails.
 */
export default createAction(routes.health, (ctx) => health.respond(ctx));
