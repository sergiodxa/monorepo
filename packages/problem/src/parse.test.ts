/**
 * Tests for reading problems: defaults for absent members, the status line winning
 * over the body, media type detection, extension validation, and every malformed
 * body reported as a failure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import { isProblem, parse, parseProblem } from "./parse.js";
import { problem } from "./problem.js";

describe("isProblem", () => {
	test("accepts the media type with parameters and any casing", () => {
		let headers = new Headers({ "Content-Type": "Application/Problem+JSON; charset=utf-8" });
		expect(isProblem({ headers })).toBe(true);
	});

	test("rejects plain JSON and a missing content type", () => {
		expect(isProblem(Response.json({}))).toBe(false);
		expect(isProblem(new Response(null))).toBe(false);
	});
});

describe("parse", () => {
	test("fills absent members with their RFC defaults", () => {
		let result = parse('{"status":404}');

		expect(result).toEqual({
			status: "success",
			data: {
				type: "about:blank",
				title: "Not Found",
				status: 404,
				detail: null,
				instance: null,
				extensions: {},
			},
		});
	});

	test("keeps extensions apart from the standard members", () => {
		let result = parse('{"type":"https://example.com/x","title":"X","status":403,"balance":30}');

		expect(isSuccess(result) && result.data.extensions).toEqual({ balance: 30 });
	});

	test("the status option takes precedence over the body's status", () => {
		let result = parse('{"status":200}', { status: 503 });

		expect(isSuccess(result) && result.data.status).toBe(503);
	});

	test.each([
		["invalid JSON", "{"],
		["an array", "[]"],
		["null", "null"],
		["no status", '{"type":"about:blank"}'],
		["a string status", '{"status":"404"}'],
		["a numeric title", '{"status":404,"title":404}'],
		["a null detail", '{"status":404,"detail":null}'],
	])("rejects %s", (_, text) => {
		expect(isFailure(parse(text))).toBe(true);
	});

	test("validates extensions with the given schema", () => {
		let schema = s.object({ balance: s.number() });

		let valid = parse('{"status":403,"balance":30}', { extensions: schema });
		let invalid = parse('{"status":403,"balance":"30"}', { extensions: schema });

		expect(isSuccess(valid) && valid.data.extensions.balance).toBe(30);
		expect(isFailure(invalid) && invalid.error.issues.length).toBeGreaterThan(0);
	});
});

describe("parseProblem", () => {
	test("round-trips what problem() writes", async () => {
		let response = problem({
			status: 403,
			type: "https://example.com/probs/out-of-credit",
			title: "You do not have enough credit.",
			instance: "/account/12345/msgs/abc",
			extensions: { balance: 30 },
		});

		let result = await parseProblem(response);

		expect(result).toEqual({
			status: "success",
			data: {
				type: "https://example.com/probs/out-of-credit",
				title: "You do not have enough credit.",
				status: 403,
				detail: null,
				instance: "/account/12345/msgs/abc",
				extensions: { balance: 30 },
			},
		});
	});

	test("reports the status line when the body disagrees", async () => {
		let response = new Response('{"status":400}', {
			status: 422,
			headers: { "Content-Type": "application/problem+json" },
		});

		let result = await parseProblem(response);

		expect(isSuccess(result) && result.data.status).toBe(422);
	});

	test("rejects a response of another media type without reading it", async () => {
		let response = Response.json({ status: 404 }, { status: 404 });

		expect(isFailure(await parseProblem(response))).toBe(true);
		expect(response.bodyUsed).toBe(false);
	});
});
