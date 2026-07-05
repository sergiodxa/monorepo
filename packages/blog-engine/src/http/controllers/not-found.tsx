import type { Database } from "remix/data-table";

import { notFound } from "@pkg/http/response/html";

import action from "../../shared/lib/action";
import { renderDocument } from "../../shared/lib/render";
import { Layout } from "../../views/layout";
import { loadSiteChrome } from "../../views/site";

/** Renders a themed 404 page (shared by the fall-through and unknown routes). */
export async function renderNotFound(db: Database): Promise<Response> {
	let chrome = await loadSiteChrome(db);
	let body = await renderDocument(
		<Layout title="Not found" {...chrome}>
			<h1>Not found</h1>
			<p>The page you are looking for does not exist.</p>
		</Layout>,
	);
	return notFound(body);
}

/** Default handler for unmapped routes. */
export default action<"ANY", "*">(async ({ db }) => renderNotFound(db));
