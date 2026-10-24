/**
 * `/health`, fetched through the app's router, and the operation the OpenAPI document publishes
 * for it.
 */

import { describe, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";

import manifest from "../../../package.json" with { type: "json" };

describe("health", () => {
	test("reports the database as passing in the application/health+json format", async () => {
		let response = await createWebRouter().fetch("https://example.com/health");

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/health+json");
		expect(await response.json()).toMatchObject({
			status: "pass",
			serviceId: manifest.name,
			checks: { "database:responseTime": [{ componentType: "datastore", status: "pass" }] },
		});
	});

	test("is documented with the report's schema for both statuses", async () => {
		let response = await createWebRouter().fetch("https://example.com/api/openapi.json");

		let document = (await response.json()) as {
			paths: Record<string, { get: { responses: Record<string, { content: object }> } }>;
		};
		let responses = document.paths["/health"]?.get.responses;
		expect(Object.keys(responses?.["200"]?.content ?? {})).toEqual(["application/health+json"]);
		expect(Object.keys(responses?.["503"]?.content ?? {})).toEqual(["application/health+json"]);
	});
});
