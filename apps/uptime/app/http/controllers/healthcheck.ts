/**
 * Health check controller. Confirms the worker can reach D1 with a trivial query and
 * responds 200/503 accordingly. It exists as an uptime target for external monitoring
 * of this app itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok, serviceUnavailable } from "@pkg/http/response/json";
import { inject } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { createAction } from "remix/router";

import { teams } from "~/database/schema";
import routes from "~/routes/web";

/** GET /healthcheck — verifies D1 connectivity. */
export default createAction(
	routes.healthcheck,
	inject([Database] as const, async (db) => {
		try {
			await db.count(teams);
			return ok({ status: "ok" });
		} catch {
			return serviceUnavailable({ status: "error" });
		}
	}),
);
