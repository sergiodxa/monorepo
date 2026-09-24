/**
 * Tests for parsing a request through an operation: params, query and body typed from
 * the declaration, each failure naming the part that failed, and bodies read by their
 * media type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import * as s from "@sdxc/json-schema";
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, expectTypeOf, test } from "vitest";

import { defineOperation } from "./operation.js";
import {
	MONITOR_CREATE,
	MONITOR_DESTROY,
	MONITOR_SHOW,
	MONITORS_INDEX,
	ROUTES,
} from "./test/fixtures.js";

/** A JSON request to the fixture API. */
function jsonRequest(path: string, body: unknown): Request {
	return new Request(`https://api.example.com${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("parse", () => {
	test("yields params, query and body typed from the declaration", async () => {
		let parsed = unwrap(
			await MONITOR_SHOW.parse(new Request("https://api.example.com/api/v1/monitors/mon_1"), {
				monitorId: "mon_1",
			}),
		);

		expect(parsed).toEqual({ params: { monitorId: "mon_1" }, query: undefined, body: undefined });
		expectTypeOf(parsed.params).toEqualTypeOf<{ monitorId: string }>();
		expectTypeOf(parsed.body).toEqualTypeOf<undefined>();
	});

	test("without a params schema, params pass through as the router's strings", async () => {
		let parsed = unwrap(
			await MONITOR_DESTROY.parse(new Request("https://api.example.com/api/v1/monitors/x"), {
				monitorId: "x",
			}),
		);

		expect(parsed.params).toEqual({ monitorId: "x" });
		expectTypeOf(parsed.params).toEqualTypeOf<{ monitorId: string }>();
	});

	test("coerces the query string, folding a repeated key into an array", async () => {
		let parsed = unwrap(
			await MONITORS_INDEX.parse(
				new Request("https://api.example.com/api/v1/monitors?limit=20"),
				{},
			),
		);
		expect(parsed.query).toEqual({ limit: 20 });

		let tagged = defineOperation("tagged", ROUTES.monitors.index, {
			summary: "Tagged",
			query: s.object({ tag: s.array(s.string()) }),
			responses: { 200: { description: "OK" } },
		});
		let multiple = unwrap(
			await tagged.parse(new Request("https://api.example.com/api/v1/monitors?tag=a&tag=b"), {}),
		);
		expect(multiple.query).toEqual({ tag: ["a", "b"] });
	});

	test("applies body defaults", async () => {
		let parsed = unwrap(
			await MONITOR_CREATE.parse(jsonRequest("/api/v1/monitors", { name: "Home" }), {}),
		);

		expect(parsed.body).toEqual({ name: "Home", intervalSeconds: 300 });
		expectTypeOf(parsed.body).toEqualTypeOf<{ name: string; intervalSeconds: number }>();
	});

	test("a failing part names its location and carries the schema's issues", async () => {
		let params = await MONITOR_SHOW.parse(new Request("https://api.example.com/x"), {
			monitorId: "nope",
		});
		let query = await MONITORS_INDEX.parse(new Request("https://api.example.com/x?limit=0"), {});
		let body = await MONITOR_CREATE.parse(jsonRequest("/x", { name: "" }), {});

		expect(isFailure(params) && params.error.location).toBe("params");
		expect(isFailure(query) && query.error.location).toBe("query");
		if (!isFailure(body)) throw new Error("expected a failure");
		expect(body.error.location).toBe("body");
		expect(body.error.issues[0]?.path).toEqual(["name"]);
	});

	test("malformed JSON and an undeclared media type fail as body errors", async () => {
		let malformed = new Request("https://api.example.com/x", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{",
		});
		let form = new Request("https://api.example.com/x", {
			method: "POST",
			headers: { "Content-Type": "text/plain" },
			body: "name=a",
		});

		let first = await MONITOR_CREATE.parse(malformed, {});
		let second = await MONITOR_CREATE.parse(form, {});
		expect(isFailure(first) && first.error.issues).toEqual([{ message: "Expected a JSON body" }]);
		expect(isFailure(second) && second.error.issues).toEqual([
			{ message: "Expected Content-Type application/json" },
		]);
	});

	test("a body declared per media type reads a form as an object", async () => {
		let operation = defineOperation("formCreate", ROUTES.monitors.create, {
			summary: "Create from a form",
			body: {
				"application/x-www-form-urlencoded": s.object({ name: s.string() }),
				"application/json": s.object({ name: s.string() }),
			},
			responses: { 201: { description: "Created" } },
		});
		let request = new Request("https://api.example.com/x", {
			method: "POST",
			body: new URLSearchParams({ name: "Home" }),
		});

		expect(unwrap(await operation.parse(request, {})).body).toEqual({ name: "Home" });
	});

	test("a request without a body validates undefined, which an optional body accepts", async () => {
		let operation = defineOperation("maybe", ROUTES.monitors.create, {
			summary: "Maybe",
			body: s.optional(s.object({ name: s.string() })),
			responses: { 201: { description: "Created" } },
		});
		let request = new Request("https://api.example.com/x", { method: "POST" });

		expect(unwrap(await operation.parse(request, {})).body).toBeUndefined();
		expect((await MONITOR_CREATE.parse(request, {})).status).toBe("failure");
	});
});
