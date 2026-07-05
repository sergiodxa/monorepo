import type { RequestContext } from "remix/fetch-router";

import { Layout } from "./components/layout";
import { loadSiteChrome } from "./site";

/** Renders a themed 404 through `ctx.render` (shared by fall-through + unknown routes). */
export async function renderNotFound(ctx: RequestContext): Promise<Response> {
	let chrome = await loadSiteChrome(ctx.db);
	return ctx.render(
		<Layout title="Not found" {...chrome}>
			<h1>Not found</h1>
			<p>The page you are looking for does not exist.</p>
		</Layout>,
		{ status: 404 },
	);
}

/** Default handler for unmapped routes. */
export default async function defaultHandler(ctx: RequestContext): Promise<Response> {
	return renderNotFound(ctx);
}
