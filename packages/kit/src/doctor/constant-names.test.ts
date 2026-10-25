/**
 * The `constant-names` check over fixture apps and the finder it runs per module.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vitest";

import { constantNamesCheck, findConstantNames, toUpperSnake } from "./constant-names.js";
import { fixture, removeFixtures } from "./fixture.js";

afterEach(removeFixtures);

describe("findConstantNames", () => {
	test("finds literal values named in another case", () => {
		let source = [
			"const maxRetries = 3;",
			"const names = ['a'] as const;",
			"const options = { retries: 3, ...BASE };",
			"const pattern = new RegExp('x');",
			"const offset = -1;",
		].join("\n");
		expect(findConstantNames("a.ts", source).map((found) => found.message)).toEqual([
			"maxRetries holds a value; name it MAX_RETRIES",
			"names holds a value; name it NAMES",
			"options holds a value; name it OPTIONS",
			"pattern holds a value; name it PATTERN",
			"offset holds a value; name it OFFSET",
		]);
	});

	test("accepts UPPER_SNAKE_CASE, exports, functions, objects of functions and call results", () => {
		let source = [
			"const MAX_RETRIES = 3;",
			"export const defaults = { retries: 3 };",
			"const run = () => 1;",
			"const builders = { a() {}, b: () => 2 };",
			"const logger = createLogger();",
		].join("\n");
		expect(findConstantNames("a.ts", source)).toEqual([]);
	});
});

describe("toUpperSnake", () => {
	test("splits camelCase words and drops stray underscores", () => {
		expect(toUpperSnake("cacheTTLSeconds")).toBe("CACHE_TTLSECONDS");
		expect(toUpperSnake("URL_")).toBe("URL");
		expect(toUpperSnake("maxRetries")).toBe("MAX_RETRIES");
	});
});

describe("constantNamesCheck", () => {
	test("warns with the file and line", async () => {
		let context = await fixture({ "config/site.ts": 'const siteName = "Docs";\n' });
		let result = await constantNamesCheck.run(context);
		expect(result.status).toBe("warn");
		expect(result.findings).toEqual([
			"config/site.ts:1: siteName holds a value; name it SITE_NAME",
		]);
	});
});
