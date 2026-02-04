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
		return new Response(result.reason as string, {
			status: 500,
			statusText: "Internal Server Error",
		});
	}

	return new Response("OK", { status: 200, statusText: "OK" });
}
