import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { data } from "react-router";
import { z } from "zod/v4";

import { dashboardTab } from "~/cookies";

import type { Route } from "./+types/route";

const schema = z.object({
	tab: z.enum(["http", "dns", "tcp", "cron-jobs"]),
});

export async function action({ request }: Route.ActionArgs) {
	let result = await validate(request, schema);

	if (isFailure(result)) {
		return data({ ok: false }, { status: 400 });
	}

	return data(
		{ ok: true },
		{
			headers: {
				"Set-Cookie": await dashboardTab.serialize(result.data.tab),
			},
		},
	);
}
