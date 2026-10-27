/**
 * Tests that `shape` survives corrupt layout tables: fonts whose GSUB, GPOS, GDEF and
 * `kern` bytes are overwritten at random still shape every run without throwing and in
 * bounded time, because every offset is bounds-checked and every lookup has a budget.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parseFont } from "../index.js";

import { shape } from "./index.js";

/** Layout tables the corruption targets. */
const LAYOUT_TABLES = new Set(["GSUB", "GPOS", "GDEF", "kern"]);

/** Text that reaches ligatures, multiple substitutions, contexts, marks and kerning. */
const TEXT = "aabbccddeeffgghhii d́x́̈ AVTo office";

/**
 * A deterministic pseudo-random generator, so a failing seed reproduces.
 *
 * @param seed - Starting state.
 */
function random(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return state / 0x100000000;
	};
}

/**
 * Copies a font and overwrites random bytes inside its layout tables.
 *
 * @param bytes - The original font.
 * @param seed - Which corruption.
 */
function corrupt(bytes: Uint8Array, seed: number): Uint8Array {
	let copy = bytes.slice();
	let view = new DataView(copy.buffer);
	let next = random(seed);
	for (let index = 0; index < view.getUint16(4); index++) {
		let record = 12 + index * 16;
		let tag = String.fromCharCode(...copy.subarray(record, record + 4));
		if (!LAYOUT_TABLES.has(tag)) continue;
		let offset = view.getUint32(record + 8);
		let length = view.getUint32(record + 12);
		for (let hit = 0; hit < Math.max(4, length / 16); hit++) {
			copy[offset + Math.floor(next() * length)] = Math.floor(next() * 256);
		}
	}
	return copy;
}

describe("corrupt layout tables", () => {
	for (let path of [
		"lookup-continuation/lookup-continuation.ttf",
		"RobotoSerif/RobotoSerif-Subset.ttf",
	]) {
		test(`shapes ${path} with 100 corruptions without throwing`, () => {
			let original = new Uint8Array(readFileSync(new URL(`../fixtures/${path}`, import.meta.url)));
			for (let seed = 1; seed <= 100; seed++) {
				let parsed = parseFont(corrupt(original, seed));
				if (!isSuccess(parsed)) continue;
				for (let direction of ["ltr", "rtl"] as const) {
					let shaped = shape(parsed.data, TEXT, { direction, features: { aalt: 3, frac: true } });
					expect(shaped.glyphs.length).toBeLessThanOrEqual(TEXT.length * 32);
				}
			}
		});
	}
});
