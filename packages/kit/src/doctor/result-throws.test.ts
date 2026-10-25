/**
 * The `result-throws` check over fixture apps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vitest";

import { fixture, removeFixtures } from "./fixture.js";
import { resultThrowsCheck, throwLines } from "./result-throws.js";

afterEach(removeFixtures);

describe("resultThrowsCheck", () => {
	test("passes Result-style code", async () => {
		let context = await fixture({
			"app/services/run.ts":
				'import { failure } from "@sdxc/result";\nexport function run() { return failure(new Error("x")); }\n',
		});
		expect((await resultThrowsCheck.run(context)).status).toBe("pass");
	});

	test("leaves out bootstrap/, whose runtime callbacks report a failure by throwing", async () => {
		let context = await fixture({
			"bootstrap/browser.ts":
				'run({ loadModule() { throw new Error("Unknown client entry module"); } });\n',
			"app/services/run.ts": "export function run() {\n\treturn 1;\n}\n",
		});
		expect((await resultThrowsCheck.run(context)).status).toBe("pass");
	});

	test("warns on throw", async () => {
		let context = await fixture({
			"app/services/run.ts": 'export function run() { throw new Error("x"); }\n',
		});
		expect((await resultThrowsCheck.run(context)).status).toBe("warn");
	});
});

describe("throwLines", () => {
	test("ignores throw inside identifiers and strings", () => {
		expect(throwLines("a.ts", 'const overthrow = "throw";\nthrow 1;\n')).toEqual([2]);
	});
});
