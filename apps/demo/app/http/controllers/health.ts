/**
 * Answers `GET /health` with the board's dependency report in `application/health+json`, so
 * an uptime monitor turns red when the database the pages read from is unreachable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { health } from "~/app/initializers/health";
import routes from "~/routes/web";

/** Probes the database: `200` while it answers, `503` once it fails or times out. */
export default createAction(routes.health, (ctx) => health.respond(ctx));
