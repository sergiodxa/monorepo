/**
 * Health check route that verifies the app can reach its database by running a
 * lightweight count query against the posts table before responding with "OK".
 * It gives uptime monitors and load balancers a simple endpoint to confirm the
 * service and its data layer are alive.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok } from "@pkg/response";
import { count } from "drizzle-orm";

import { posts } from "~/db/schema";
import { getDB } from "~/middleware/drizzle";

import type { Route } from "./+types/route";

export async function loader(_: Route.LoaderArgs) {
	await getDB().select({ value: count() }).from(posts);
	return ok({ message: "OK" });
}
