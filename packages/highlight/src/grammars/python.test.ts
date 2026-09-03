/**
 * Tests the Python grammar, with an eye on the string forms — triple-quoted,
 * prefixed, interpolated — that a shorter grammar gets wrong.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { scan } from "../lexer.js";

import { python } from "./python.js";

/** The runs a rule claimed, with the plain text between them dropped. */
function painted(code: string) {
	return scan(code, python)
		.filter((token) => token.type !== "plain")
		.map((token) => [token.type, token.value]);
}

describe("python", () => {
	test("paints a comment", () => {
		expect(painted("# Python example\nimport os")).toEqual([
			["comment", "# Python example"],
			["keyword", "import"],
		]);
	});

	test("paints a keyword", () => {
		expect(painted("from os import environ")).toEqual([
			["keyword", "from"],
			["keyword", "import"],
		]);
	});

	test("paints None as a keyword and the two booleans as booleans", () => {
		expect(painted("x = None or True or False")).toEqual([
			["operator", "="],
			["keyword", "None"],
			["keyword", "or"],
			["boolean", "True"],
			["keyword", "or"],
			["boolean", "False"],
		]);
	});

	test("paints a definition name and the name of a call", () => {
		expect(painted("def run_scheduled_job():\n    sync_inventory_data()")).toEqual([
			["keyword", "def"],
			["function", "run_scheduled_job"],
			["punctuation", "():"],
			["function", "sync_inventory_data"],
			["punctuation", "()"],
		]);
	});

	test("paints a class definition name", () => {
		expect(painted("class Monitor(Base):")).toEqual([
			["keyword", "class"],
			["class-name", "Monitor"],
			["punctuation", "("],
			["punctuation", "):"],
		]);
	});

	test("paints a builtin rather than a call", () => {
		expect(painted("print(len(range(3)))")).toEqual([
			["builtin", "print"],
			["punctuation", "("],
			["builtin", "len"],
			["punctuation", "("],
			["builtin", "range"],
			["punctuation", "("],
			["number", "3"],
			["punctuation", ")))"],
		]);
	});

	test("paints a decorator", () => {
		expect(painted("@app.route\ndef index():")).toEqual([
			["keyword", "@app.route"],
			["keyword", "def"],
			["function", "index"],
			["punctuation", "():"],
		]);
	});

	test("paints a triple-quoted string as one run", () => {
		expect(painted('"""Ping the monitor.\n\nTwo paragraphs.\n"""')).toEqual([
			["string", '"""Ping the monitor.\n\nTwo paragraphs.\n"""'],
		]);
	});

	test("paints a prefixed string", () => {
		expect(painted(String.raw`pattern = rb"\d+"`)).toEqual([
			["operator", "="],
			["string", String.raw`rb"\d+"`],
		]);
	});

	test("leaves the tail of a name from being read as a string prefix", () => {
		expect(painted('for x in "ab"')).toEqual([
			["keyword", "for"],
			["keyword", "in"],
			["string", '"ab"'],
		]);
	});

	test("paints an f-string's replacement field as code", () => {
		expect(painted('f"Bearer {token}"')).toEqual([
			["string", 'f"Bearer '],
			["punctuation", "{"],
			["punctuation", "}"],
			["string", '"'],
		]);
	});

	test("keeps a doubled brace inside the string", () => {
		expect(painted('f"{{literal}}"')).toEqual([["string", 'f"{{literal}}"']]);
	});

	test("paints a number in every base", () => {
		expect(painted("0xff 0b1010 0o17 1_000 3.5 .5 2e10")).toEqual([
			["number", "0xff"],
			["number", "0b1010"],
			["number", "0o17"],
			["number", "1_000"],
			["number", "3.5"],
			["number", ".5"],
			["number", "2e10"],
		]);
	});

	test("paints a walrus and a return annotation as one operator each", () => {
		expect(painted("def f(x) -> int:\n    if (n := 1):")).toEqual([
			["keyword", "def"],
			["function", "f"],
			["punctuation", "("],
			["punctuation", ")"],
			["operator", "->"],
			["builtin", "int"],
			["punctuation", ":"],
			["keyword", "if"],
			["punctuation", "("],
			["operator", ":="],
			["number", "1"],
			["punctuation", "):"],
		]);
	});

	/** Lifted from `apps/uptime/resources/docs/concepts/cron-jobs.md`. */
	test("scans a real snippet", () => {
		let code = [
			"# Python example",
			"import os",
			"import requests",
			"",
			"def run_scheduled_job():",
			"    # Your job logic here",
			"    sync_inventory_data()",
			"",
			"    requests.post(",
			"        'https://uptime.sergiodxa.com/api/v1/cron-jobs/{monitor-id}/ping',",
			"        headers={'Authorization': f\"Bearer {os.environ['UPTIME_API_KEY']}\"},",
			"    )",
			"",
		].join("\n");

		let tokens = scan(code, python);

		expect(tokens.map((token) => token.value).join("")).toBe(code);

		expect(tokens).toContainEqual({ type: "comment", value: "# Python example" });
		expect(tokens).toContainEqual({ type: "function", value: "run_scheduled_job" });
		expect(tokens).toContainEqual({ type: "function", value: "post" });
		expect(tokens).toContainEqual({
			type: "string",
			value: "'https://uptime.sergiodxa.com/api/v1/cron-jobs/{monitor-id}/ping'",
		});
		expect(tokens).toContainEqual({ type: "string", value: "'UPTIME_API_KEY'" });
	});
});
