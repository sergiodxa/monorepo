import type { ActionFunctionArgs } from "react-router";

import { env } from "cloudflare:workers";
import { z } from "zod/v4";

let bodySchema = z.object({
	startDate: z.string().optional(),
	endDate: z.string().optional(),
});

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method Not Allowed" }, { status: 405 });
	}

	let json: unknown;
	try {
		json = await request.json();
	} catch {
		json = {};
	}

	let parsed = bodySchema.safeParse(json);
	if (!parsed.success) {
		return Response.json({ error: "Invalid body" }, { status: 400 });
	}

	await env.QUEUE.send({
		type: "backfillDailyStats",
		startDate: parsed.data.startDate,
		endDate: parsed.data.endDate,
	});

	return Response.json({ status: "queued" }, { status: 202 });
}
