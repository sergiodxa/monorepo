/**
 * Runs RFC 7396's own examples through `apply`, then the guarantees the RFC leaves to
 * the implementation: inputs are never mutated, and a member named `__proto__` is data.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { JSONValue } from "./json-value.js";

import { apply } from "./apply.js";
import { APPENDIX_A_EXAMPLES, SECTION_3_EXAMPLE } from "./fixtures/rfc7396.js";

describe("apply", () => {
	test("produces the Section 3 result", () => {
		let { original, patch, result } = SECTION_3_EXAMPLE;
		expect(apply(original, patch)).toEqual(result);
	});

	test.each(APPENDIX_A_EXAMPLES.map((example, index) => ({ ...example, row: index + 1 })))(
		"produces Appendix A row $row",
		({ original, patch, result }) => {
			expect(apply(original, patch)).toEqual(result);
		},
	);

	test("leaves the target and the patch untouched", () => {
		let target = { a: { b: 1, c: [1, 2] } };
		let patch = { a: { b: null, d: { e: 1 } } };
		let targetCopy = structuredClone(target);
		let patchCopy = structuredClone(patch);

		let result = apply(target, patch);

		expect(result).toEqual({ a: { c: [1, 2], d: { e: 1 } } });
		expect(target).toEqual(targetCopy);
		expect(patch).toEqual(patchCopy);
	});

	test("shares no array with the patch, so editing the result leaves the patch intact", () => {
		let patch = { tags: ["a"] };
		let result = apply({}, patch) as { tags: string[] };
		result.tags.push("b");
		expect(patch.tags).toEqual(["a"]);
	});

	test("writes a __proto__ member as an own property", () => {
		let patch = JSON.parse('{"__proto__":{"polluted":true}}') as JSONValue;
		let result = apply({}, patch) as Record<string, unknown>;

		expect(Object.hasOwn(result, "__proto__")).toBe(true);
		expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
	});
});
