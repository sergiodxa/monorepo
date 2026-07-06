/**
 * Health-check route (GET /healthcheck). Its loader probes the two critical backing
 * services in parallel — a Drizzle query against the clients table and a KV list —
 * and returns "OK" only when both succeed, otherwise a 500 naming the failed one.
 * Exists so uptime monitors can verify the worker's database and KV connectivity.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { text } from "@pkg/http/response";
import { InternalServerError, Ok } from "@pkg/http/status-code";
import { env } from "cloudflare:workers";
import { count } from "drizzle-orm";

import * as schema from "~/db/schema";
import { db } from "~/middleware/drizzle";

export async function loader() {
	let results = await Promise.allSettled([
		db()
			.select({ count: count() })
			.from(schema.clients)
			.catch(() => {
				throw new Error("Database connection error");
			}),
		env.KV.list().catch(() => {
			throw new Error("KV connection error");
		}),
	]);

	for (let result of results) {
		if (result.status === "fulfilled") continue;
		return text(result.reason as string, InternalServerError);
	}

	return text("OK", Ok);
}
