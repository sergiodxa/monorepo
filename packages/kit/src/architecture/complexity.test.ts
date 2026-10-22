/**
 * Cyclomatic complexity of representative functions: straight-line code scores 1, each decision
 * adds one, and nested functions are measured on their own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { measureComplexity } from "./complexity.js";

describe("measureComplexity", () => {
	test("scores a straight-line function as 1", () => {
		let source = `export function add(a: number, b: number) {\n\treturn a + b;\n}\n`;
		expect(measureComplexity("a.ts", source)).toEqual([{ name: "add", line: 1, complexity: 1 }]);
	});

	test("counts if, logical operators and ternary points", () => {
		let source = `export function pick(a: number, b: number) {
	if (a && b) return a ? 1 : 2;
	return 0;
}
`;
		expect(measureComplexity("a.ts", source)).toEqual([{ name: "pick", line: 1, complexity: 4 }]);
	});

	test("measures methods and nested functions separately", () => {
		let source = `export class Box {
	run(x: number) {
		if (x) {
			const inner = () => (x > 1 ? 1 : 0);
			return inner();
		}
		return 0;
	}
}
`;
		let result = measureComplexity("a.ts", source);
		expect(result).toEqual([
			{ name: "Box.run", line: 2, complexity: 2 },
			{ name: "(anonymous)", line: 4, complexity: 2 },
		]);
	});
});
