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
