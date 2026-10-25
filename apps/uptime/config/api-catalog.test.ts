/**
 * Holds uptime's API catalog to RFC 9727: served as a link set with the RFC 9727 profile,
 * answering `HEAD` with its `api-catalog` link, and naming the `v1` API's OpenAPI document,
 * reference docs and health report by absolute URL on the requesting origin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { MEDIA_TYPE, parse } from "@sdxc/well-known/api-catalog";
import { wellKnown } from "@sdxc/well-known/middleware";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { apiCatalogEntry } from "~/config/api-catalog";

/** A router answering only the catalog. */
const ROUTER = createRouter({ middleware: [wellKnown({ "api-catalog": apiCatalogEntry })] });

describe("GET /.well-known/api-catalog", () => {
	test("lists the v1 API with its OpenAPI document, docs and health report", async () => {
		let response = await ROUTER.fetch("https://uptime.example.com/.well-known/api-catalog");

		expect(response.headers.get("Content-Type")).toBe(MEDIA_TYPE);
		let catalog = parse(await response.text());
		if (isFailure(catalog)) throw catalog.error;
		expect(catalog.data.links.map(({ rel, href }) => [rel, href])).toEqual([
			["item", "https://uptime.example.com/api/v1"],
			["service-desc", "https://uptime.example.com/api/v1/openapi.json"],
			["service-doc", "https://uptime.example.com/docs/api/overview"],
			["status", "https://uptime.example.com/health"],
		]);
	});

	test("answers HEAD with the api-catalog link", async () => {
		let response = await ROUTER.fetch(
			new Request("https://uptime.example.com/.well-known/api-catalog", { method: "HEAD" }),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Link")).toBe('</.well-known/api-catalog>; rel="api-catalog"');
	});
});
