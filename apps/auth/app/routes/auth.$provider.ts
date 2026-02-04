import { href, redirect } from "react-router";

import { db } from "~/middleware/drizzle";
import { github } from "~/providers/github";

import type { Route } from "./+types/auth.$provider";

export async function action({ request, params }: Route.ActionArgs) {
	if (params.provider === "github") await github(db(), request);
	return redirect(href("/authorize"));
}
