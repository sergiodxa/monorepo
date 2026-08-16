/**
 * The `/health` controller: a trivial liveness probe used by uptime checks and load
 * balancers to confirm the worker is serving requests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { json } from "@pkg/http/response";
import { createAction } from "remix/router";

import routes from "~/routes/web";

/**
 * Liveness probe handler for `GET /health`.
 *
 * @returns A JSON response `{ status: "ok" }`.
 */
export default createAction(routes.health, async () => json({ status: "ok" }));
