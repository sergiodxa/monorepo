import type { ActionFunctionArgs } from "react-router";

import { env } from "cloudflare:workers";

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method Not Allowed" }, { status: 405 });
	}

	await env.QUEUE.send({ type: "backfillDailyStats" });

	return Response.json({ status: "queued" }, { status: 202 });
}
