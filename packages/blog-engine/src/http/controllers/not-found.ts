import type { Database } from "remix/data-table";

import { notFound } from "@pkg/http/response/html";

import action from "../../shared/lib/action";
import { documentLayout } from "../../views/layout";
import { loadSiteChrome } from "../../views/site";

/** Renders a themed 404 page (shared by the fall-through and unknown routes). */
export async function renderNotFound(db: Database): Promise<Response> {
	let chrome = await loadSiteChrome(db);
	return notFound(
		documentLayout({
			title: "Not found",
			siteTitle: chrome.siteTitle,
			description: chrome.description,
			themeStyle: chrome.themeStyle,
			customCss: chrome.customCss,
			navLinks: chrome.navLinks,
			body: `<h1>Not found</h1><p>The page you are looking for does not exist.</p>`,
		}),
	);
}

/** Default handler for unmapped routes. */
export default action<"ANY", "*">(async ({ db }) => renderNotFound(db));
