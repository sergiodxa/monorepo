/**
 * `GET /health`, the dependency report an uptime monitor polls. It answers without a session,
 * in `application/health+json`: `200` while every critical dependency answers, `503` once one
 * does not, with each probe's status and timing in the body.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { health } from "~/app/initializers/health";
import routes from "~/routes/web";

/** Probes every binding and service the reader depends on, in parallel and read-only. */
export default createAction(routes.health, (ctx) => health.respond(ctx));
