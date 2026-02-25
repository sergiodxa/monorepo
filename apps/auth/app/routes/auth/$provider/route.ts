import { getClientIP } from "@pkg/get-client-ip";
import { href, redirect } from "react-router";

import { db } from "~/middleware/drizzle";
import { checkRateLimit, rateLimitResponse } from "~/modules/rate-limit";
import { github } from "~/strategies/github";

import type { Route } from "./+types/route";

export async function action({ request, params }: Route.ActionArgs) {
	// Rate limit login attempts by IP
	let ip = getClientIP(request) ?? "unknown";
	if (!(await checkRateLimit("LOGIN_RATE_LIMITER", ip))) {
		return rateLimitResponse();
	}

	if (params.provider === "github") await github(db(), request);
	return redirect(href("/authorize"));
}
