/**
 * Health-check endpoint route whose loader verifies database connectivity by counting
 * rows in the teams and monitors tables in parallel, returning "OK" with a 200 when
 * both succeed or the failure reason with a 500 otherwise. It exists so uptime probes
 * and orchestrators can confirm the app and its database are reachable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { text } from "@pkg/http/response";
import { InternalServerError, Ok } from "@pkg/http/status-code";
import { count } from "drizzle-orm";

import * as schema from "~/db/schema";
import { db } from "~/middleware/drizzle";

export async function loader() {
	let results = await Promise.allSettled([
		db()
			.select({ count: count() })
			.from(schema.teams)
			.execute()
			.catch(() => {
				throw new Error("Failed to count teams");
			}),

		db()
			.select({ count: count() })
			.from(schema.monitors)
			.execute()
			.catch(() => {
				throw new Error("Failed to count monitors");
			}),
	]);

	for (let result of results) {
		if (result.status === "fulfilled") continue;
		return text(result.reason as string, InternalServerError);
	}

	return text("OK", Ok);
}
