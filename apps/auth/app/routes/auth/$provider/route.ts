/**
 * The social-login initiation route (/auth/:provider). Its action rate-limits by IP
 * and hands off to the matching provider strategy (currently GitHub) to start the
 * external OAuth flow, redirecting back to /authorize when no redirect is produced.
 * Exists as the entry point that kicks off third-party sign-in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getClientIP } from "@pkg/get-client-ip";
import { href, redirect } from "react-router";

import { db } from "~/middleware/drizzle";
import { rateLimit } from "~/modules/rate-limit";
import { github } from "~/strategies/github";

import type { Route } from "./+types/route";

export async function action({ request, params }: Route.ActionArgs) {
	// Rate limit login attempts by IP
	let ip = getClientIP(request) ?? "unknown";
	let limited = await rateLimit("LOGIN_RATE_LIMITER", ip);
	if (limited) return limited;

	if (params.provider === "github") await github(db(), request);
	return redirect(href("/authorize"));
}
