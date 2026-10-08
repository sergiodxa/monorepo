/**
 * Tests the GF(256) arithmetic and Reed–Solomon division against published values: the
 * standard's degree-7 generator polynomial and the field's defining identities.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import { gfMultiply, reedSolomonDivisor, reedSolomonRemainder } from "./reed-solomon.js";

test("multiplies by the reducing polynomial 0x11D", () => {
	expect(gfMultiply(0x80, 0x02)).toBe(0x1d);
	expect(gfMultiply(0x53, 0xca)).toBe(gfMultiply(0xca, 0x53));
	expect(gfMultiply(0x57, 0x01)).toBe(0x57);
	expect(gfMultiply(0x57, 0x00)).toBe(0x00);
});

test("α generates every non-zero element once", () => {
	let seen = new Set<number>();
	let element = 1;
	for (let power = 0; power < 255; power++) {
		seen.add(element);
		element = gfMultiply(element, 0x02);
	}
	expect(seen.size).toBe(255);
	expect(element).toBe(1);
});

test("builds the standard's degree-7 generator polynomial", () => {
	expect(Array.from(reedSolomonDivisor(7))).toEqual([127, 122, 154, 164, 11, 68, 117]);
});

test("a block followed by its remainder divides evenly", () => {
	let divisor = reedSolomonDivisor(10);
	let data = new Uint8Array([0x10, 0x20, 0x0c, 0x56, 0x61, 0x80, 0xec, 0x11]);
	let remainder = reedSolomonRemainder(data, divisor);
	let codeword = new Uint8Array([...data, ...remainder]);
	expect(Array.from(reedSolomonRemainder(codeword, divisor))).toEqual(
		Array.from({ length: 10 }, () => 0),
	);
});
