/**
 * The `fetch-param` check over fixture apps and the finder it runs per module.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vitest";

import { fetchParamCheck, findFetchParams } from "./fetch-param.js";
import { fixture, removeFixtures } from "./fixture.js";

afterEach(removeFixtures);

describe("findFetchParams", () => {
	test("finds a typeof fetch parameter and option", () => {
		let source = [
			"export function load(url: string, fetchImpl: typeof fetch = fetch) {}",
			"interface Options {",
			"\tfetch?: typeof fetch;",
			"}",
		].join("\n");
		expect(findFetchParams("a.ts", source).map((found) => found.line)).toEqual([1, 3]);
	});

	test("accepts a direct call to the global fetch", () => {
		expect(findFetchParams("a.ts", 'await fetch("https://example.com");\n')).toEqual([]);
	});
});

describe("fetchParamCheck", () => {
	test("warns with the file and line", async () => {
		let context = await fixture({
			"app/services/client.ts": "export function get(fetcher: typeof fetch) {}\n",
		});
		let result = await fetchParamCheck.run(context);
		expect(result.status).toBe("warn");
		expect(result.findings).toEqual(["app/services/client.ts:1: typeof fetch"]);
	});
});
