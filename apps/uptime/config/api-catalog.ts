/**
 * Uptime's RFC 9727 API catalog, served at `/.well-known/api-catalog`, so a client finds the
 * public `v1` API, its OpenAPI document, its reference docs and the health report from the
 * origin alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { apiCatalog, build } from "@sdxc/well-known/api-catalog";
import { serve } from "@sdxc/well-known/middleware";

import routes from "~/routes/web";

/**
 * The `wellKnown()` entry answering `/.well-known/api-catalog`. Paths resolve against the
 * requesting origin, so a preview deployment lists its own endpoints.
 *
 * @example
 * wellKnown({ "api-catalog": apiCatalogEntry });
 */
export const apiCatalogEntry = serve(apiCatalog, (ctx) =>
	build({
		url: new URL("/.well-known/api-catalog", ctx.url),
		apis: [
			{
				url: "/api/v1",
				title: "Uptime API",
				serviceDesc: [{ href: routes.api.v1.openapi.href(), type: "application/openapi+json" }],
				serviceDoc: [{ href: routes.docs.show.href({ slug: "api/overview" }), type: "text/html" }],
				status: [{ href: routes.health.href(), type: "application/health+json" }],
			},
		],
	}),
);
