/**
 * Tests for reading another service's report: the media type check, and `parseHealth`
 * validating the format, normalizing every status alias, and naming why a body is refused.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { schemaDocument } from "./document.js";
import { isHealthResponse, parseHealth } from "./parse.js";

/** The draft's own example report, `node` being one of the keys it lets an implementation add. */
const DRAFT_EXAMPLE = {
	status: "pass",
	version: "1",
	releaseId: "1.2.2",
	notes: [""],
	output: "",
	serviceId: "f03e522f-1f44-4062-9b55-9587f91c9c41",
	description: "health of authz service",
	checks: {
		"cassandra:responseTime": [
			{
				componentId: "dfd6cf2b-1b6e-4412-a0b8-f6f7797a60d2",
				componentType: "datastore",
				observedValue: 250,
				observedUnit: "ms",
				status: "pass",
				affectedEndpoints: ["/users/{userId}", "/customers/{customerId}/status"],
				time: "2019-01-20T10:03:46.420Z",
				output: "",
				links: { self: "http://api.example.com/dbnode/dfd6cf2b/health" },
			},
		],
		uptime: [
			{
				componentType: "system",
				observedValue: 1209600.245,
				observedUnit: "s",
				status: "pass",
				time: "2018-01-17T03:36:48Z",
			},
		],
		"cpu:utilization": [
			{ componentId: "6fd416e0", node: 1, status: "pass", time: "2018-01-17T03:36:48Z" },
		],
	},
	links: { about: "http://api.example.com/about/authz" },
};

describe("isHealthResponse", () => {
	test("accepts the media type with parameters and in any case", () => {
		let response = new Response("{}", {
			headers: { "Content-Type": "Application/Health+JSON; charset=utf-8" },
		});
		expect(isHealthResponse(response)).toBe(true);
	});

	test("refuses plain JSON", () => {
		expect(isHealthResponse(Response.json({ status: "pass" }))).toBe(false);
	});
});

describe("parseHealth", () => {
	test("reads the draft's example, keeping keys an implementation adds", () => {
		let result = parseHealth(JSON.stringify(DRAFT_EXAMPLE));

		expect(isSuccess(result) && result.data).toEqual(DRAFT_EXAMPLE);
	});

	test.each([
		["OK", "pass"],
		["Up", "pass"],
		["WARN", "warn"],
		["error", "fail"],
		["DOWN", "fail"],
	])("normalizes %s to %s, in the report and in its checks", (sent, normalized) => {
		let result = parseHealth(JSON.stringify({ status: sent, checks: { db: [{ status: sent }] } }));

		expect(isSuccess(result) && result.data).toEqual({
			status: normalized,
			checks: { db: [{ status: normalized }] },
		});
	});

	test.each([
		["a body that is not JSON", "<html>", "not valid JSON"],
		["a report without status", "{}", "status"],
		["an unknown status", '{"status":"green"}', "status"],
		["a check key with two colons", '{"status":"pass","checks":{"a:b:c":[]}}', "checks"],
		["a relative link", '{"status":"pass","links":{"self":"/health"}}', "links.self"],
		["a time that is not a date", '{"status":"pass","checks":{"db":[{"time":"soon"}]}}', "time"],
	])("refuses %s", (_, body, mentioned) => {
		let result = parseHealth(body);

		expect(isFailure(result) && result.error.message).toContain(mentioned);
	});
});

describe("schema.json", () => {
	test("matches the schema it is generated from; run `bun run schema` when it does not", async () => {
		let file = JSON.parse(await readFile(new URL("../schema.json", import.meta.url), "utf8"));
		let document = schemaDocument();

		expect(isSuccess(document) && document.data).toEqual(file);
	});
});
