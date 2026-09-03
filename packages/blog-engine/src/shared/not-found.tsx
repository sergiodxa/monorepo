/**
 * The engine's 404 handling: {@link renderNotFound} renders a themed not-found page
 * through the public layout, and the default export is the router's fall-through
 * handler for unmapped routes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { RequestContext } from "remix/router";

import { getServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";

import { Layout } from "./components/layout";
import { loadSiteChrome } from "./site";

/**
 * Renders a themed 404 page through `ctx.render`, reusing the public site chrome so
 * the not-found page matches the rest of the blog. Shared by the router fall-through
 * and by controllers that hit an unknown type/slug.
 * @param ctx - The current request context.
 * @returns A 404 HTML response.
 */
export async function renderNotFound(ctx: RequestContext): Promise<Response> {
	let chrome = await loadSiteChrome(getServiceContainer().get(Database));
	return ctx.render(
		<Layout title="Not found" {...chrome}>
			<h1>Not found</h1>
			<p>The page you are looking for does not exist.</p>
		</Layout>,
		{ status: 404 },
	);
}

/**
 * The router's `defaultHandler`, invoked for any request that matches no route.
 * @param ctx - The current request context.
 * @returns A themed 404 response.
 */
export default async function defaultHandler(ctx: RequestContext): Promise<Response> {
	return renderNotFound(ctx);
}
