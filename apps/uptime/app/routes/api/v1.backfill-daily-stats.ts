/**
 * API endpoint that triggers a backfill of daily statistics: its POST action enqueues a
 * `backfillDailyStats` message on the Cloudflare queue and returns 202 Accepted, while
 * other methods get 405. It exists to kick off the async daily-stats recomputation job
 * on demand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ActionFunctionArgs } from "react-router";

import { accepted, methodNotAllowed } from "@pkg/http/response/json";
import { env } from "cloudflare:workers";

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return methodNotAllowed({ error: "Method Not Allowed" });
	}

	await env.QUEUE.send({ type: "backfillDailyStats" });

	return accepted({ status: "queued" });
}
