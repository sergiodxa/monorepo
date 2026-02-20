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
