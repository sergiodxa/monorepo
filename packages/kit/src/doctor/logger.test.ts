/**
 * The `logger` check over fixture apps and the finder it runs per module.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vitest";

import { fixture, removeFixtures } from "./fixture.js";
import { findLoggerInstances, loggerCheck } from "./logger.js";

afterEach(removeFixtures);

describe("findLoggerInstances", () => {
	test("accepts a logger built in an initializer", () => {
		let source = 'export const logger = createLogger({ service: "app" });\n';
		expect(findLoggerInstances("app/initializers/logger.ts", source)).toEqual([]);
	});

	test("finds a logger built anywhere else", () => {
		let source = "export function handle() {\n\tlet log = createLogger();\n}\n";
		expect(findLoggerInstances("app/http/controllers/home.ts", source)).toEqual([
			{ line: 2, message: "calls createLogger()" },
		]);
	});
});

describe("loggerCheck", () => {
	test("warns on a controller that builds its own logger", async () => {
		let context = await fixture({
			"app/initializers/logger.ts": "export const logger = createLogger();\n",
			"app/http/controllers/home.ts": "let log = createLogger();\n",
		});
		let result = await loggerCheck.run(context);
		expect(result.status).toBe("warn");
		expect(result.findings).toEqual(["app/http/controllers/home.ts:1: calls createLogger()"]);
	});
});
