/**
 * The blog's health check, the URL an uptime monitor polls. It answers with an
 * `application/health+json` report over every binding and service the blog reads, so a
 * `200` means the pages work, not only that the Worker started.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { health } from "~/app/initializers/health";
import routes from "~/routes/web";

/** GET /health — `200` while every critical dependency answers, `503` once one fails. */
export default createAction(routes.health, (ctx) => health.respond(ctx));
