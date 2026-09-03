/**
 * Tests for the boolean: that a probability of zero and one are absolute, and
 * that the default lands near half.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { createRandom } from "../random";

import { createDatatypeModule } from "./datatype";

function module(seed: string) {
	return createDatatypeModule(createRandom(seed));
}

describe("boolean", () => {
	test("treats a probability of zero and one as never and always", () => {
		let datatype = module("bounds");

		expect(Array.from({ length: 50 }, () => datatype.boolean({ probability: 0 }))).not.toContain(
			true,
		);
		expect(Array.from({ length: 50 }, () => datatype.boolean({ probability: 1 }))).not.toContain(
			false,
		);
	});

	test("lands near half by default", () => {
		let datatype = module("halves");
		let trues = Array.from({ length: 1000 }, () => datatype.boolean()).filter(Boolean);

		expect(trues.length).toBeGreaterThan(400);
		expect(trues.length).toBeLessThan(600);
	});

	test("honors a probability between the two", () => {
		let datatype = module("weighted");
		let trues = Array.from({ length: 1000 }, () => datatype.boolean({ probability: 0.2 })).filter(
			Boolean,
		);

		expect(trues.length).toBeGreaterThan(120);
		expect(trues.length).toBeLessThan(280);
	});
});
