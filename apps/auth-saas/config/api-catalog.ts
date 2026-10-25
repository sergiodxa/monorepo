/**
 * The platform's RFC 9727 API catalog, served at `/.well-known/api-catalog` on the platform
 * and management hosts so a client probing either finds the management API, its OpenAPI
 * document and the platform's health report.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { apiCatalog, build } from "@sdxc/well-known/api-catalog";
import { serve } from "@sdxc/well-known/middleware";
import { env } from "cloudflare:workers";

import managementRoutes from "~/routes/management";
import webRoutes from "~/routes/web";

/**
 * The `wellKnown()` entry answering `/.well-known/api-catalog`. Every link is absolute, so
 * both hosts answer the same catalog apart from its own URL.
 *
 * @example
 * wellKnown({ "api-catalog": apiCatalogEntry });
 */
export const apiCatalogEntry = serve(apiCatalog, (ctx) => {
	let management = `https://api.${env.PLATFORM_DOMAIN}`;
	return build({
		url: new URL("/.well-known/api-catalog", ctx.url),
		apis: [
			{
				url: `${management}/`,
				title: "Management API",
				serviceDesc: [
					{
						href: new URL(managementRoutes.openapi.href(), management),
						type: "application/openapi+json",
					},
				],
				status: [
					{
						href: new URL(webRoutes.health.href(), `https://${env.PLATFORM_DOMAIN}`),
						type: "application/health+json",
					},
				],
			},
		],
	});
});
