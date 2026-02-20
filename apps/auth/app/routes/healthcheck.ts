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
