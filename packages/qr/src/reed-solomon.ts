/**
 * Reed–Solomon error correction over GF(256) with the QR reducing polynomial 0x11D. Field
 * multiplication is shift-and-XOR, which needs no log tables and so no work at import time;
 * a generator polynomial is built per block length on demand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The product of two field elements, reduced modulo x⁸ + x⁴ + x³ + x² + 1. */
export function gfMultiply(x: number, y: number): number {
	let product = 0;
	for (let bit = 7; bit >= 0; bit--) {
		product = (product << 1) ^ ((product >>> 7) * 0x11d);
		product ^= ((y >>> bit) & 1) * x;
	}
	return product;
}

/**
 * The generator polynomial (x − α⁰)(x − α¹)…(x − α^(degree−1)), coefficients from the
 * highest power down with the leading 1 dropped, as the remainder division expects.
 */
export function reedSolomonDivisor(degree: number): Uint8Array {
	let divisor = new Uint8Array(degree);
	divisor[degree - 1] = 1;
	let root = 1;
	for (let step = 0; step < degree; step++) {
		for (let index = 0; index < degree; index++) {
			let product = gfMultiply(divisor[index] ?? 0, root);
			divisor[index] = index + 1 < degree ? product ^ (divisor[index + 1] ?? 0) : product;
		}
		root = gfMultiply(root, 0x02);
	}
	return divisor;
}

/** The error correction codewords for one block: the remainder of `data` divided by `divisor`. */
export function reedSolomonRemainder(data: Uint8Array, divisor: Uint8Array): Uint8Array {
	let remainder = new Uint8Array(divisor.length);
	for (let byte of data) {
		let factor = byte ^ (remainder[0] ?? 0);
		remainder.copyWithin(0, 1);
		remainder[remainder.length - 1] = 0;
		for (let index = 0; index < divisor.length; index++) {
			remainder[index] = (remainder[index] ?? 0) ^ gfMultiply(divisor[index] ?? 0, factor);
		}
	}
	return remainder;
}
