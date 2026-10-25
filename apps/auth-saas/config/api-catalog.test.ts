/**
 * Holds the platform's API catalog to RFC 9727: served as a link set with the RFC 9727
 * profile, answering `HEAD` with its `api-catalog` link, and naming the management API's
 * OpenAPI document and the platform's health report by absolute URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { MEDIA_TYPE, parse } from "@sdxc/well-known/api-catalog";
import { wellKnown } from "@sdxc/well-known/middleware";
import { env } from "cloudflare:workers";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { apiCatalogEntry } from "~/config/api-catalog";

/** The platform host as a URL spells it, lowercased. */
const PLATFORM = new URL(`https://${env.PLATFORM_DOMAIN}`).host;

/** A router answering only the catalog. */
const ROUTER = createRouter({ middleware: [wellKnown({ "api-catalog": apiCatalogEntry })] });

describe("GET /.well-known/api-catalog", () => {
	test("lists the management API with its OpenAPI document and health report", async () => {
		let response = await ROUTER.fetch(`https://api.${env.PLATFORM_DOMAIN}/.well-known/api-catalog`);

		expect(response.headers.get("Content-Type")).toBe(MEDIA_TYPE);
		let catalog = parse(await response.text());
		if (isFailure(catalog)) throw catalog.error;
		expect(catalog.data.links.map(({ rel, href }) => [rel, href])).toEqual([
			["item", `https://api.${PLATFORM}/`],
			["service-desc", `https://api.${PLATFORM}/openapi.json`],
			["status", `https://${PLATFORM}/health`],
		]);
	});

	test("answers HEAD with the api-catalog link", async () => {
		let response = await ROUTER.fetch(
			new Request(`https://${env.PLATFORM_DOMAIN}/.well-known/api-catalog`, { method: "HEAD" }),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Link")).toBe('</.well-known/api-catalog>; rel="api-catalog"');
	});
});
