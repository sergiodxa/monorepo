/**
 * The site's fetch-router: the global middleware stack (head requests, async context, logging
 * and tracing, form data, cross-origin protection, security headers, document assets, HTML
 * rendering) and every route mapped onto its controller. The worker builds it per request and
 * the router tests drive it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RouterContext } from "remix/router";

import { assets } from "@sdxc/assets-middleware";
import { headRequests } from "@sdxc/http/middleware/head-requests";
import { lazy } from "@sdxc/lazy-route";
import { log } from "@sdxc/logger/middleware";
import { securityHeaders } from "@sdxc/security-headers/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { userAgent } from "@sdxc/user-agent/middleware";
import { asyncContext } from "remix/middleware/async-context";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { render } from "remix/middleware/render";
import { createRouter } from "remix/router";

import defaultHandler from "~/app/http/controllers/default-handler";
import canonicalHost from "~/app/http/middleware/canonical-host";
import frameTransforms from "~/app/http/middleware/frame-transforms";
import importMapHash from "~/app/http/middleware/import-map-hash";
import socialCards from "~/app/http/middleware/social-cards";
import { assetResolver } from "~/app/initializers/assets";
import { logger } from "~/app/initializers/logger";
import { SECURITY_POLICY } from "~/config/security-policy";
import routes from "~/routes/web";

/** The context a controller sees once the router's middleware has run. */
export type AppContext = RouterContext<ReturnType<typeof createWebRouter>>;

declare module "remix/router" {
	/** Types `createAction` and `createController` with the context the router's chain builds. */
	interface RouterTypes {
		context: AppContext;
	}
}

/**
 * Builds the HTTP router. `headRequests()` leads the chain so a `HEAD` probe reads like its
 * `GET` to every later step. Each route is mapped on its own through `lazy()`, since
 * `router.map` throws on a nested route group, so a request imports only its controller.
 *
 * @returns The configured router the worker forwards requests to.
 */
export function createWebRouter() {
	let router = createRouter({
		middleware: [
			headRequests(),
			asyncContext(),
			log(logger),
			trace(),
			canonicalHost(),
			frameTransforms(),
			socialCards((request): Promise<Response> => router.fetch(request)),
			userAgent(),
			formData(),
			/** The CSP report endpoint takes the browser's own report POSTs and reads no cookie. */
			cop({ insecureBypassPatterns: [routes.cspReports.href()] }),
			/**
			 * Right before the assets and the renderer, so the headers land on the response it
			 * produced, and the import map's hash joins the policy once both have published.
			 */
			securityHeaders(SECURITY_POLICY),
			assets(assetResolver, {
				stylesheets: "resources/layouts/document.tsx",
				script: "bootstrap/browser.ts",
			}),
			importMapHash(),
			render({ assets: assetResolver }),
		],
		defaultHandler,
	});

	router.map(
		routes.home,
		lazy(() => import("~/app/http/controllers/home")),
	);
	router.map(
		routes.docs.index,
		lazy(() => import("~/app/http/controllers/docs-index")),
	);
	router.map(
		routes.docs.changelog,
		lazy(() => import("~/app/http/controllers/changelog")),
	);
	router.map(
		routes.docs.show,
		lazy(() => import("~/app/http/controllers/docs-show")),
	);
	router.map(
		routes.api.index,
		lazy(() => import("~/app/http/controllers/packages-index")),
	);
	router.map(
		routes.api.utility,
		lazy(() => import("~/app/http/controllers/utility-show")),
	);
	router.map(
		routes.api.component,
		lazy(() => import("~/app/http/controllers/component-show")),
	);
	router.map(
		routes.api.uiExport,
		lazy(() => import("~/app/http/controllers/ui-export-show")),
	);
	router.map(
		routes.api.show,
		lazy(() => import("~/app/http/controllers/packages-show")),
	);
	router.map(
		routes.moved.packages,
		lazy(() => import("~/app/http/controllers/moved").then((it) => it.movedPackages)),
	);
	router.map(
		routes.moved.package,
		lazy(() => import("~/app/http/controllers/moved").then((it) => it.movedPackage)),
	);
	router.map(
		routes.philosophy,
		lazy(() => import("~/app/http/controllers/philosophy")),
	);
	router.map(
		routes.showcase,
		lazy(() => import("~/app/http/controllers/showcase")),
	);
	router.map(
		routes.security,
		lazy(() => import("~/app/http/controllers/security")),
	);
	router.map(
		routes.maintenance,
		lazy(() => import("~/app/http/controllers/maintenance")),
	);
	router.map(
		routes.sponsors,
		lazy(() => import("~/app/http/controllers/sponsors")),
	);
	router.map(
		routes.sponsorsWebhook,
		lazy(() => import("~/app/http/controllers/sponsors-webhook")),
	);

	/** The same pages as markdown, plus the surfaces derived from what is in the bundle. */
	router.map(
		routes.markdown.docs,
		lazy(() => import("~/app/http/controllers/markdown-twin")),
	);
	router.map(
		routes.markdown.package,
		lazy(() => import("~/app/http/controllers/markdown-twin").then((it) => it.packageMarkdown)),
	);
	router.map(
		routes.markdown.utility,
		lazy(() => import("~/app/http/controllers/markdown-twin").then((it) => it.utilityMarkdownTwin)),
	);
	router.map(
		routes.markdown.component,
		lazy(() =>
			import("~/app/http/controllers/markdown-twin").then((it) => it.componentMarkdownTwin),
		),
	);
	router.map(
		routes.markdown.uiExport,
		lazy(() =>
			import("~/app/http/controllers/markdown-twin").then((it) => it.uiExportMarkdownTwin),
		),
	);
	router.map(
		routes.frames.preview,
		lazy(() => import("~/app/http/controllers/frame-preview")),
	);
	router.map(
		routes.frames.example,
		lazy(() => import("~/app/http/controllers/frame-preview").then((it) => it.frameExample)),
	);
	router.map(
		routes.frames.utility,
		lazy(() => import("~/app/http/controllers/frame-preview").then((it) => it.frameUtilityExample)),
	);
	router.map(
		routes.examples.visit,
		lazy(() => import("~/app/http/controllers/examples").then((it) => it.exampleVisit)),
	);
	router.map(
		routes.examples.submit,
		lazy(() => import("~/app/http/controllers/examples").then((it) => it.exampleSubmit)),
	);
	router.map(
		routes.llms,
		lazy(() => import("~/app/http/controllers/llms")),
	);
	router.map(
		routes.sitemap,
		lazy(() => import("~/app/http/controllers/sitemap")),
	);
	router.map(
		routes.feed,
		lazy(() => import("~/app/http/controllers/feed")),
	);
	router.map(
		routes.searchIndex,
		lazy(() => import("~/app/http/controllers/search-index")),
	);
	router.map(
		routes.search,
		lazy(() => import("~/app/http/controllers/search")),
	);
	router.map(
		routes.searchFrame,
		lazy(() => import("~/app/http/controllers/search-frame")),
	);

	/** One address answers both halves of the endpoint: the page, and the protocol. */
	router.map(
		routes.mcp,
		lazy(() => import("~/app/http/controllers/mcp")),
	);
	router.post(
		routes.mcp.pattern,
		lazy(() => import("~/app/http/controllers/mcp").then((it) => it.mcpEndpoint)),
	);
	router.map(
		routes.cspReports,
		lazy(() => import("~/app/http/controllers/csp-reports")),
	);
	router.map(
		routes.health,
		lazy(() => import("~/app/http/controllers/health")),
	);
	router.map(
		routes.schemas.health,
		lazy(() => import("~/app/http/controllers/schemas/health")),
	);
	router.map(
		routes.robots,
		lazy(() => import("~/app/http/controllers/robots")),
	);

	return router;
}
