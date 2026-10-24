/**
 * `GET /health` — the site's dependency health report in `application/health+json`, which
 * an uptime monitor polls: `200` while every critical dependency answers, `503` once one
 * does not.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { health } from "~/app/initializers/health";
import routes from "~/routes/web";

/** Runs every probe in parallel and answers with the report; each probe's timeout bounds it. */
export default createAction(routes.health, (ctx) => health.respond(ctx));
