/**
 * Tests `GET /schemas/health.json` through the real router: it answers the document
 * `@sdxc/health` ships, at the URL its `$id` names, as a long-lived public JSON Schema.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import HEALTH_SCHEMA from "@sdxc/health/schema.json" with { type: "json" };
import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";

describe("GET /schemas/health.json", () => {
	test("serves the package's schema at the URL its $id names", async () => {
		let { pathname } = new URL(HEALTH_SCHEMA.$id);

		let response = await fetchApp(pathname);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(HEALTH_SCHEMA);
	});

	test("answers as a JSON Schema any origin may cache and read", async () => {
		let response = await fetchApp("/schemas/health.json");

		expect(response.headers.get("content-type")).toBe("application/schema+json");
		expect(response.headers.get("access-control-allow-origin")).toBe("*");
		expect(response.headers.get("cache-control")).toMatch(/public/);
		expect(response.headers.get("cache-control")).toMatch(/max-age=86400/);
	});
});
