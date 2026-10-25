/**
 * The `local-const` check over fixture apps and the finder it runs per module.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vitest";

import { fixture, removeFixtures } from "./fixture.js";
import { findLocalConsts, localConstCheck } from "./local-const.js";

afterEach(removeFixtures);

describe("findLocalConsts", () => {
	test("accepts module-level and exported constants", () => {
		expect(findLocalConsts("a.ts", "const A = 1;\nexport const B = 2;\n")).toEqual([]);
	});

	test("finds a const in a function, a callback and a block", () => {
		let source = [
			"function run() {",
			"\tconst a = 1;",
			"\t[1].map(() => { const b = 2; return b; });",
			"\treturn a;",
			"}",
			"if (true) { const c = 3; }",
			"for (const item of []) {}",
		].join("\n");
		expect(findLocalConsts("a.ts", source).map((found) => found.line)).toEqual([2, 3, 6, 7]);
	});

	test("accepts a namespace's members, which are module members", () => {
		let source = "export namespace JWK {\n\texport const thumbprint = digest;\n}\n";
		expect(findLocalConsts("a.ts", source)).toEqual([]);
	});

	test("leaves out ambient declarations", () => {
		expect(findLocalConsts("a.ts", "declare global {\n\tconst VERSION: string;\n}\n")).toEqual([]);
	});

	test("yields nothing for a module oxc cannot parse", () => {
		expect(findLocalConsts("a.ts", "function (")).toEqual([]);
	});
});

describe("localConstCheck", () => {
	test("warns on a const inside a test callback", async () => {
		let context = await fixture({
			"app/services/run.test.ts": 'test("x", () => {\n\tconst value = 1;\n});\n',
		});
		let result = await localConstCheck.run(context);
		expect(result.status).toBe("warn");
		expect(result.findings).toEqual([
			"app/services/run.test.ts:2: const inside a function or block",
		]);
	});

	test("skips a project with no app source", async () => {
		expect((await localConstCheck.run(await fixture({}))).status).toBe("skip");
	});
});
