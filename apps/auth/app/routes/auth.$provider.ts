import { href, redirect } from "react-router";

import { db } from "~/middleware/drizzle";
import { github } from "~/providers/github";
import { google } from "~/providers/google";

import type { Route } from "./+types/auth.$provider";

export async function action({ request, params }: Route.ActionArgs) {
	if (params.provider === "github") await github(db(), request);
	if (params.provider === "google") await google(db(), request);
	return redirect(href("/authorize"));
}
