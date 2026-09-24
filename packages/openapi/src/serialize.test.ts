/**
 * Tests for reading and writing documents: JSON and YAML round trips of a built
 * document, and the version and shape checks a parse applies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parse, stringify } from "./serialize.js";
import { createFixtureDocument } from "./test/fixtures.js";

describe("stringify and parse", () => {
	test("a built document round-trips through JSON", () => {
		let document = unwrap(createFixtureDocument().build());
		let text = unwrap(stringify(document));

		expect(text.endsWith("}\n")).toBe(true);
		expect(unwrap(parse(text))).toEqual(document);
	});

	test("a built document round-trips through YAML", () => {
		let document = unwrap(createFixtureDocument().build());
		let text = unwrap(stringify(document, { format: "yaml" }));

		expect(text.startsWith("openapi: 3.1.1\n")).toBe(true);
		expect(unwrap(parse(text))).toEqual(document);
	});

	test("indent sets the spaces per level", () => {
		let document = unwrap(createFixtureDocument().build());
		expect(unwrap(stringify(document, { indent: 4 }))).toContain('\n    "openapi": "3.1.1"');
	});

	test("a value JSON cannot write is a failure", () => {
		let document = { openapi: "3.1.1", info: { title: "T", version: "1" }, x: 1n };
		expect(stringify(document).status).toBe("failure");
	});
});

describe("parse", () => {
	test("accepts any 3.1.x document with an info title and version", () => {
		let result = parse('{"openapi":"3.1.0","info":{"title":"T","version":"1"}}');
		expect(unwrap(result).openapi).toBe("3.1.0");
	});

	test("refuses another version, a missing info, or a misshapen top-level member", () => {
		let messages = [
			'{"openapi":"3.0.3","info":{"title":"T","version":"1"}}',
			'{"openapi":"3.1.1"}',
			'{"openapi":"3.1.1","info":{"title":"T","version":"1"},"paths":[]}',
			'{"openapi":"3.1.1","info":{"title":"T","version":"1"},"servers":{}}',
			"[]",
		].map((text) => {
			let result = parse(text);
			return isFailure(result) ? result.error.message : null;
		});

		expect(messages).toEqual([
			'Expected openapi 3.1.x, found "3.0.3"',
			"info must be an object with a string title and version",
			"paths must be an object",
			"servers must be an array",
			"An OpenAPI document is an object",
		]);
	});

	test("malformed JSON is a failure naming JSON", () => {
		let result = parse("{");
		expect(isFailure(result) && result.error.message.startsWith("Invalid JSON")).toBe(true);
	});
});
