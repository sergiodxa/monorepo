/**
 * `GET /health`: the worker's dependency health as an `application/health+json` report, for
 * an uptime monitor to poll. It answers `503` when Polar or Buttondown is unreachable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { health } from "~/app/initializers/health";
import routes from "~/routes/web";

/** GET /health — probes every service the funnel depends on. */
export default createAction(routes.health, (ctx) => health.respond(ctx));
