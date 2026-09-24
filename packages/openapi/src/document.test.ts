import * as s from "@sdxc/json-schema";
import { defineProblems } from "@sdxc/problem";
import { isFailure, unwrap } from "@sdxc/result";
import * as ds from "remix/data-schema";
import { get, route } from "remix/routes";
import { describe, expect, test } from "vitest";

/**
 * Tests for assembling a document: path templates and parameters, named schemas hoisted
 * to components, problem entries as responses merging per status, security checks,
 * and every way a build fails.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { OpenAPI } from "./types.js";

import { createDocument } from "./document.js";
import { defineOperation } from "./operation.js";
import { bearer } from "./security.js";
import {
	createFixtureDocument,
	MONITOR_CREATE,
	MONITOR_SHOW,
	PROBLEMS,
	ROUTES,
} from "./test/fixtures.js";

/** Builds the fixture document, failing the test on a build error. */
function buildFixture(): OpenAPI.Document {
	return unwrap(createFixtureDocument().build());
}

/** A bare document, for tests about one operation. */
function bareDocument() {
	return createDocument({
		info: { title: "T", version: "1" },
		servers: [{ url: "https://x.test" }],
	});
}

describe("the document", () => {
	test("declares OpenAPI 3.1.1, the 2020-12 dialect, its info and servers", () => {
		let document = buildFixture();

		expect(document.openapi).toBe("3.1.1");
		expect(document.jsonSchemaDialect).toBe("https://spec.openapis.org/oas/3.1/dialect/base");
		expect(document.info).toEqual({ title: "Monitors API", version: "1" });
		expect(document.servers).toEqual([{ url: "https://api.example.com" }]);
		expect(document.security).toEqual([{ apiKey: [] }]);
		expect(document.components?.securitySchemes).toEqual({
			apiKey: { type: "http", scheme: "bearer", description: "An API key" },
		});
	});

	test("a relative server URL fails, since the document never reads one from a request", () => {
		let result = createDocument({
			info: { title: "T", version: "1" },
			servers: [{ url: "/" }],
		}).build();

		expect(isFailure(result) && result.error.pointer).toBe("/servers/0/url");
	});
});

describe("paths and parameters", () => {
	test(":param becomes {param}, a required path parameter described by its schema", () => {
		let operation = buildFixture().paths?.["/api/v1/monitors/{monitorId}"]?.get;

		expect(operation?.operationId).toBe("monitorShow");
		expect(operation?.parameters).toEqual([
			{
				name: "monitorId",
				in: "path",
				required: true,
				schema: { type: "string", pattern: "^mon_\\d+$" },
			},
		]);
	});

	test("a variable without a params schema documents as a string", () => {
		let operation = buildFixture().paths?.["/api/v1/monitors/{monitorId}"]?.delete;
		expect(operation?.parameters).toEqual([
			{ name: "monitorId", in: "path", required: true, schema: { type: "string" } },
		]);
	});

	test("query keys become query parameters, required unless optional", () => {
		let operation = buildFixture().paths?.["/api/v1/monitors"]?.get;
		expect(operation?.parameters).toEqual([
			{
				name: "limit",
				in: "query",
				required: false,
				schema: { type: ["number", "string"], minimum: 1, maximum: 100 },
			},
			{ name: "cursor", in: "query", required: false, schema: { type: "string" } },
		]);
	});

	test("the request body documents its input side as application/json", () => {
		let operation = buildFixture().paths?.["/api/v1/monitors"]?.post;
		expect(operation?.requestBody).toEqual({
			required: true,
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							name: { type: "string", minLength: 1 },
							intervalSeconds: { type: "integer", minimum: 60, default: 300 },
						},
						required: ["name"],
					},
				},
			},
		});
	});

	test("params naming other keys than the pattern's variables fail the build", () => {
		let operation = defineOperation("monitorShow", ROUTES.monitors.show, {
			summary: "Show",
			// @ts-expect-error -- params must name exactly the route's variables
			params: s.object({ id: s.string() }),
			responses: { 200: { description: "OK" } },
		});
		let result = bareDocument().add(operation).build();

		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error.operationId).toBe("monitorShow");
		expect(result.error.pointer).toBe("/paths/~1api~1v1~1monitors~1{monitorId}/get/parameters");
	});

	test("an optional segment fails, since every template variable is required", () => {
		let routes = route({ page: get("/posts(/:page)") });
		let operation = defineOperation("posts", routes.page, {
			summary: "Posts",
			responses: { 200: { description: "OK" } },
		});
		let result = bareDocument().add(operation).build();

		expect(isFailure(result) && result.error.message).toContain("optional segment");
	});

	test("a route that matches any method fails", () => {
		let routes = route({ anything: "/anything" });
		let operation = defineOperation("anything", routes.anything, {
			summary: "Anything",
			responses: { 200: { description: "OK" } },
		});
		let result = bareDocument().add(operation).build();

		expect(isFailure(result) && result.error.message).toContain("matches any method");
	});

	test("a duplicate operationId fails", () => {
		let twice = createFixtureDocument().add(MONITOR_SHOW).build();

		expect(isFailure(twice) && twice.error.message).toBe('Operation "monitorShow" is added twice');
	});
});

describe("schemas", () => {
	test("named schemas hoist into components.schemas and every $ref points there", () => {
		let document = buildFixture();
		let body = document.paths?.["/api/v1/monitors/{monitorId}"]?.get?.responses?.["200"];

		expect(body).toEqual({
			description: "The monitor",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: { data: { $ref: "#/components/schemas/Monitor" } },
						required: ["data"],
					},
				},
			},
		});
		expect(document.components?.schemas?.Monitor).toEqual({
			type: "object",
			properties: {
				id: { type: "string", pattern: "^mon_\\d+$" },
				name: { type: "string" },
				intervalSeconds: { type: "integer" },
				enabledAt: { type: ["integer", "null"] },
			},
			required: ["id", "name", "intervalSeconds", "enabledAt"],
		});
	});

	test("response headers document their schema and whether they are required", () => {
		let response = buildFixture().paths?.["/api/v1/monitors"]?.get?.responses?.["200"];
		expect(response).toMatchObject({
			headers: { Link: { schema: { type: "string" }, required: false } },
		});
	});

	test("two different schemas under one name fail", () => {
		let a = defineOperation("a", route({ a: get("/a") }).a, {
			summary: "A",
			responses: { 200: { description: "OK", body: s.string().meta({ id: "Thing" }) } },
		});
		let b = defineOperation("b", route({ b: get("/b") }).b, {
			summary: "B",
			responses: { 200: { description: "OK", body: s.integer().meta({ id: "Thing" }) } },
		});
		let result = bareDocument().add(a, b).build();

		expect(isFailure(result) && result.error.pointer).toBe("/components/schemas/Thing");
	});

	test("a schema that cannot describe itself fails pointing at where it sits", () => {
		let operation = defineOperation("a", route({ a: get("/a") }).a, {
			summary: "A",
			responses: {
				200: { description: "OK", body: ds.string() as unknown as s.Schema<string> },
			},
		});
		let result = bareDocument().add(operation).build();

		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error.pointer).toBe(
			"/paths/~1a/get/responses/200/content/application~1json/schema",
		);
		expect(result.error.cause).toBeInstanceOf(s.JSONSchemaConversionError);
	});
});

describe("problems", () => {
	test("the catalog becomes a base Problem schema, a schema per entry and a response per entry", () => {
		let components = buildFixture().components;

		expect(components?.schemas?.Problem).toMatchObject({ type: "object" });
		expect(components?.schemas?.NotFoundProblem).toEqual({
			allOf: [
				{ $ref: "#/components/schemas/Problem" },
				{
					type: "object",
					properties: {
						type: { const: "https://docs.example.com/errors/not-found" },
						title: { const: "The resource does not exist" },
						status: { const: 404 },
					},
					required: ["type", "title", "status"],
				},
			],
		});
		expect(components?.responses?.NotFound).toEqual({
			description: "The resource does not exist",
			content: {
				"application/problem+json": { schema: { $ref: "#/components/schemas/NotFoundProblem" } },
			},
		});
	});

	test("an entry's extension schema joins its allOf", () => {
		let schema = buildFixture().components?.schemas?.ValidationErrorProblem;
		expect(schema?.allOf?.[2]).toMatchObject({
			type: "object",
			properties: { errors: { type: "array" } },
			required: ["errors"],
		});
	});

	test("one problem on a status is a $ref to its response", () => {
		let responses = buildFixture().paths?.["/api/v1/monitors/{monitorId}"]?.get?.responses;
		expect(responses?.["404"]).toEqual({ $ref: "#/components/responses/NotFound" });
		expect(responses?.["401"]).toEqual({ $ref: "#/components/responses/Unauthorized" });
	});

	test("problems sharing a status merge into one response with oneOf", () => {
		let responses = buildFixture().paths?.["/api/v1/monitors"]?.post?.responses;
		expect(responses?.["400"]).toEqual({
			description: "The request is malformed; The request failed validation",
			content: {
				"application/problem+json": {
					schema: {
						oneOf: [
							{ $ref: "#/components/schemas/BadRequestProblem" },
							{ $ref: "#/components/schemas/ValidationErrorProblem" },
						],
					},
				},
			},
		});
	});

	test("an extension schema that cannot describe itself fails the build", () => {
		let problems = defineProblems("https://x.test/errors/", {
			teapot: {
				slug: "teapot",
				status: 418,
				title: "Teapot",
				extensions: ds.object({ a: ds.string() }),
			},
		});
		let result = createDocument({
			info: { title: "T", version: "1" },
			servers: [{ url: "https://x.test" }],
			problems,
		}).build();

		expect(isFailure(result) && result.error.pointer).toBe("/components/schemas/TeapotProblem");
	});

	test("a status declared both as a response and a problem fails", () => {
		let operation = defineOperation("show", ROUTES.monitors.show, {
			summary: "Show",
			responses: { 404: { description: "Gone" } },
			problems: ["notFound"],
		});
		let result = createDocument({
			info: { title: "T", version: "1" },
			servers: [{ url: "https://x.test" }],
			problems: PROBLEMS,
		})
			.add(operation)
			.build();

		expect(isFailure(result) && result.error.message).toContain(
			"both as a response and as a problem",
		);
	});

	test("a problem the catalog lacks fails to compile when added", () => {
		let operation = defineOperation("update", ROUTES.monitors.update, {
			summary: "Update",
			responses: { 200: { description: "OK" } },
			problems: ["gone"],
		});
		// @ts-expect-error -- "gone" is not an entry of the catalog
		let result = createFixtureDocument().add(operation).build();

		expect(isFailure(result) && result.error.message).toContain('lists problem "gone"');
	});
});

describe("security", () => {
	test("an operation's requirement replaces the default, and [] marks it unauthenticated", () => {
		let paths = buildFixture().paths;

		expect(paths?.["/api/v1/monitors"]?.post?.security).toEqual([{ apiKey: ["monitors:write"] }]);
		expect(paths?.["/api/v1/monitors/{monitorId}"]?.delete?.security).toEqual([]);
		expect(paths?.["/api/v1/monitors/{monitorId}"]?.get).not.toHaveProperty("security");
	});

	test("an undeclared scheme fails", () => {
		let operation = defineOperation("create", ROUTES.monitors.create, {
			summary: "Create",
			responses: { 201: { description: "Created" } },
			security: [{ oauth: ["write"] }],
		});
		let result = bareDocument().add(operation).build();

		expect(isFailure(result) && result.error.message).toBe(
			'Security scheme "oauth" is not declared',
		);
	});

	test("scopes lists every scope any operation requires, per scheme", () => {
		expect(createFixtureDocument().scopes()).toEqual({
			apiKey: ["monitors:read", "monitors:write"],
		});
	});

	test("operations and problems expose what the builder holds, for tooling", () => {
		let document = createDocument({
			info: { title: "T", version: "1" },
			servers: [{ url: "https://x.test" }],
			securitySchemes: { apiKey: bearer() },
			problems: PROBLEMS,
		}).add(MONITOR_CREATE);

		expect(document.operations().map((operation) => operation.operationId)).toEqual([
			"monitorCreate",
		]);
		expect(document.problems().map((entry) => entry.name)).toEqual([
			"badRequest",
			"validationError",
			"unauthorized",
			"notFound",
		]);
		expect(bareDocument().problems()).toEqual([]);
	});
});
