/**
 * Application bootstrap that assembles the fetch-router. It registers the global
 * middleware stack (head requests, async context, request logging and tracing, form data,
 * cross-origin protection, HTML rendering), maps routes onto their controllers, and
 * wires the request-scoped renderer. It exists as the composition root shared by the
 * worker and by router-level tests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { Middleware, RequestContext } from "remix/router";

import { headRequests } from "@sdxc/http/middleware/head-requests";
import { log } from "@sdxc/logger/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { userAgent } from "@sdxc/user-agent/middleware";
import { asyncContext } from "remix/middleware/async-context";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { render, renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";

import changelog from "~/app/http/controllers/changelog";
import componentShow from "~/app/http/controllers/component-show";
import defaultHandler from "~/app/http/controllers/default-handler";
import docsIndex from "~/app/http/controllers/docs-index";
import docsShow from "~/app/http/controllers/docs-show";
import { exampleSubmit, exampleVisit } from "~/app/http/controllers/examples";
import feed from "~/app/http/controllers/feed";
import framePreview, { frameExample } from "~/app/http/controllers/frame-preview";
import home from "~/app/http/controllers/home";
import llms from "~/app/http/controllers/llms";
import maintenance from "~/app/http/controllers/maintenance";
import markdownTwin, {
	componentMarkdownTwin,
	packageMarkdown,
	uiExportMarkdownTwin,
	utilityMarkdownTwin,
} from "~/app/http/controllers/markdown-twin";
import mcpPage, { mcpEndpoint } from "~/app/http/controllers/mcp";
import { movedPackage, movedPackages } from "~/app/http/controllers/moved";
import packagesIndex from "~/app/http/controllers/packages-index";
import packagesShow from "~/app/http/controllers/packages-show";
import philosophy from "~/app/http/controllers/philosophy";
import searchIndex from "~/app/http/controllers/search-index";
import security from "~/app/http/controllers/security";
import showcase from "~/app/http/controllers/showcase";
import sitemap from "~/app/http/controllers/sitemap";
import sponsors from "~/app/http/controllers/sponsors";
import sponsorsWebhook from "~/app/http/controllers/sponsors-webhook";
import uiExportShow from "~/app/http/controllers/ui-export-show";
import utilityShow from "~/app/http/controllers/utility-show";
import { assets, documentAssets } from "~/app/services/assets";
import { DocumentAssets } from "~/resources/layouts/document";
import routes from "~/routes/web";

import { logger } from "./logger";

/**
 * Where an agent speaks the Model Context Protocol. Written out rather than taken from
 * the route table because that entry declares the `GET` a person lands on, and a `POST`
 * to the same path is the other half of the same endpoint.
 */
/**
 * Builds the HTTP router. `headRequests()` leads the chain so a `HEAD` probe reads
 * like its `GET` to every later step, and each route is mapped on its own since
 * `router.map` throws on a nested route group.
 *
 * @returns The configured router the worker forwards requests to.
 */
export default function application() {
	let globalMiddleware: Middleware[] = [
		headRequests(),
		asyncContext(),
		log(logger) as Middleware,
		trace() as Middleware,
		formData() as Middleware,
		cop(),
		render({ assets }) as Middleware,
		renderWith(withDocumentAssets) as Middleware,
		userAgent(),
	];

	let router = createRouter({ middleware: globalMiddleware, defaultHandler });

	router.map(routes.home, home);
	router.map(routes.docs.index, docsIndex);
	router.map(routes.docs.changelog, changelog);
	router.map(routes.docs.show, docsShow);
	router.map(routes.api.index, packagesIndex);
	router.map(routes.api.utility, utilityShow);
	router.map(routes.api.component, componentShow);
	router.map(routes.api.uiExport, uiExportShow);
	router.map(routes.api.show, packagesShow);
	router.map(routes.moved.packages, movedPackages);
	router.map(routes.moved.package, movedPackage);
	router.map(routes.philosophy, philosophy);
	router.map(routes.showcase, showcase);
	router.map(routes.security, security);
	router.map(routes.maintenance, maintenance);
	router.map(routes.sponsors, sponsors);
	router.map(routes.sponsorsWebhook, sponsorsWebhook);

	/* The same pages as markdown, plus the surfaces derived from what is in the bundle. */
	router.map(routes.markdown.docs, markdownTwin);
	router.map(routes.markdown.package, packageMarkdown);
	router.map(routes.markdown.utility, utilityMarkdownTwin);
	router.map(routes.markdown.component, componentMarkdownTwin);
	router.map(routes.markdown.uiExport, uiExportMarkdownTwin);
	router.map(routes.frames.preview, framePreview);
	router.map(routes.frames.example, frameExample);
	router.map(routes.examples.visit, exampleVisit);
	router.map(routes.examples.submit, exampleSubmit);
	router.map(routes.llms, llms);
	router.map(routes.sitemap, sitemap);
	router.map(routes.feed, feed);
	router.map(routes.searchIndex, searchIndex);

	/* One address answers both halves of the endpoint: the page, and the protocol. */
	router.map(routes.mcp, mcpPage);
	router.post(routes.mcp.pattern, mcpEndpoint);

	return router;
}

/**
 * Wraps the request's renderer so every page reads the document's asset URLs from
 * context, looked up on each render. The wrapped renderer is Remix's own, which is
 * what resolves a `<Frame>` through this router and prepends `<!DOCTYPE html>`.
 */
export function withDocumentAssets(ctx: RequestContext) {
	let renderPage = ctx.render;

	return async function render(node: RemixNode, init?: ResponseInit) {
		let assets = await documentAssets();
		return await renderPage(<DocumentAssets value={assets}>{node}</DocumentAssets>, init);
	};
}
