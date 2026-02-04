import { ok } from "@pkg/response";
import { count } from "drizzle-orm";

import { posts } from "~/db/schema";
import { getDB } from "~/middleware/drizzle";

import type { Route } from "./+types/route";

export async function loader(_: Route.LoaderArgs) {
	await getDB().select({ value: count() }).from(posts);
	return ok({ message: "OK" });
}
