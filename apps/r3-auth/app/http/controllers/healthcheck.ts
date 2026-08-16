/**
 * The health check. Probes the two dependencies this server cannot serve a single
 * request without — the database and the KV namespace holding sessions and codes —
 * and names the one that failed, so a monitor's alert already says where to look.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { text } from "@pkg/http/response";
import { InternalServerError, Ok } from "@pkg/http/status-code";
import { inject } from "@pkg/service-container";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";
import { createAction } from "remix/router";

import { clients } from "~/database/schema";
import routes from "~/routes/web";

/** GET /healthcheck — verifies database and KV connectivity. */
export default createAction(
	routes.healthcheck,
	inject([Database] as const, async (db) => {
		// Settled rather than raced, so a single call reports the first broken dependency
		// instead of whichever one happened to fail fastest.
		let results = await Promise.allSettled([
			db.count(clients).catch(() => {
				throw new Error("Database connection error");
			}),
			env.KV.list().catch(() => {
				throw new Error("KV connection error");
			}),
		]);

		for (let result of results) {
			if (result.status === "fulfilled") continue;
			let reason: unknown = result.reason;
			return text(reason instanceof Error ? reason.message : "Unknown error", InternalServerError);
		}

		return text("OK", Ok);
	}),
);
