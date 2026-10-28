/**
 * HTTP router for the micro-APIs Worker: logging, x402 seller, security headers,
 * document assets and every free or priced route.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RouterContext } from "remix/router";

import { assets } from "@sdxc/assets-middleware";
import getClientIP from "@sdxc/get-client-ip/middleware";
import { headRequests } from "@sdxc/http/middleware/head-requests";
import { lazy } from "@sdxc/lazy-route";
import { log } from "@sdxc/logger/middleware";
import { securityHeaders } from "@sdxc/security-headers/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { x402 } from "@sdxc/x402/middleware";
import { asyncContext } from "remix/middleware/async-context";
import { render } from "remix/middleware/render";
import { createRouter } from "remix/router";

import { requireMcpToolPayment } from "~/app/http/middleware/require-mcp-tool-payment";
import { requireOperationPayment } from "~/app/http/middleware/require-operation-payment";
import { assetResolver } from "~/app/initializers/assets";
import { logger } from "~/app/initializers/logger";
import { sellerConfig } from "~/app/initializers/x402";
import { SECURITY_POLICY } from "~/config/security-policy";
import routes from "~/routes/web";

/** The context a controller sees once the router's middleware has run. */
export type AppContext = RouterContext<ReturnType<typeof createWebRouter>>;

declare module "remix/router" {
	/** Types `createAction` with the context the router's chain builds. */
	interface RouterTypes {
		context: AppContext;
	}
}

/**
 * Builds the HTTP router. Free routes (`/`, `/v1`, `/health`) need no payment;
 * `/v1/*id` and priced MCP tool calls collect through x402.
 */
export function createWebRouter() {
	let router = createRouter({
		middleware: [
			headRequests(),
			asyncContext(),
			log(logger),
			trace(),
			getClientIP(),
			x402(sellerConfig()),
			securityHeaders(SECURITY_POLICY),
			assets(assetResolver, {
				stylesheets: "resources/layouts/document.tsx",
				script: "bootstrap/browser.ts",
				nonce: (ctx) => ctx.securityHeaders.nonce,
			}),
			render({ assets: assetResolver }),
		],
	});

	router.map(
		routes.home,
		lazy(() => import("~/app/http/controllers/home")),
	);
	router.map(
		routes.catalog,
		lazy(() => import("~/app/http/controllers/catalog")),
	);
	router.map(
		routes.health,
		lazy(() => import("~/app/http/controllers/health")),
	);
	router.map(
		routes.mcp,
		lazy(
			() =>
				import("~/app/initializers/mcp").then((it) => (ctx: AppContext) => it.default.fetch(ctx)),
			[requireMcpToolPayment],
		),
	);
	router.map(
		routes.operation,
		lazy(() => import("~/app/http/controllers/operation"), [requireOperationPayment]),
	);

	return router;
}
