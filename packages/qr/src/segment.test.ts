/**
 * Tests the optimal segmenter: the modes Nayuki's reference picks for every fixture, and
 * the properties a seeded corpus checks, that no segmentation costs more bits than the
 * single-mode encoding and that every segment's count fits its field.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Random } from "@sdxc/random";

import { createRandom, systemSeed } from "@sdxc/random";
import { describe, expect, test } from "vitest";

import type { QrMode } from "./segment.js";

import FIXTURES from "./fixtures/nayuki.json" with { type: "json" };
import { charCountBits, textSegments, totalBits } from "./segment.js";

const SEED = Number(process.env.FUZZ_SEED) || systemSeed();

/** Character pools the corpus mixes runs from, one per mode plus multi-byte text. */
const POOLS = [
	"0123456789",
	"ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:",
	"abcdefghijklmnopqrstuvwxyz?&=_@",
	"éü世界🙂",
];

/** Text built from runs of random pools, so mode boundaries land everywhere. */
function mixedText(random: Random): string {
	let text = "";
	let runs = random.int(0, 8);
	for (let run = 0; run < runs; run++) {
		let pool = Array.from(random.pick(POOLS));
		let length = random.int(1, 40);
		for (let index = 0; index < length; index++) text += random.pick(pool);
	}
	return text;
}

/**
 * Bits for the whole text as one segment in the single mode every character allows, or
 * `Infinity` when that segment's count overflows its field, as no single segment then exists.
 */
function singleModeBits(text: string, version: number): number {
	let length = text.length;
	let mode: QrMode = /^[0-9]*$/.test(text)
		? "numeric"
		: /^[0-9A-Z $%*+\-./:]*$/.test(text)
			? "alphanumeric"
			: "byte";
	let bytes = new TextEncoder().encode(text).length;
	let count = mode === "byte" ? bytes : length;
	if (count >= 2 ** charCountBits(mode, version)) return Infinity;

	let header = 4 + charCountBits(mode, version);
	if (mode === "numeric") return header + 10 * Math.floor(length / 3) + [0, 4, 7][length % 3]!;
	if (mode === "alphanumeric") return header + 11 * Math.floor(length / 2) + 6 * (length % 2);
	return header + 8 * bytes;
}

test("picks the modes Nayuki's optimal segmenter picks", () => {
	for (let fixture of FIXTURES.filter((entry) => entry.reference === "nayuki-java-optimal")) {
		let modes = textSegments(fixture.input, fixture.version).map((segment) => segment.mode);
		expect(modes).toEqual(fixture.segments as QrMode[]);
	}
});

test("leaves text of one mode in one segment", () => {
	expect(textSegments("0123456789", 1).map((segment) => segment.mode)).toEqual(["numeric"]);
	expect(textSegments("HELLO WORLD", 1).map((segment) => segment.mode)).toEqual(["alphanumeric"]);
	expect(textSegments("hello", 1).map((segment) => segment.mode)).toEqual(["byte"]);
});

test("splits a run that outgrows its count field", () => {
	let segments = textSegments("7".repeat(1500), 1);
	expect(segments.map((segment) => segment.count)).toEqual([1023, 477]);
});

describe(`segmentation properties (FUZZ_SEED=${SEED})`, () => {
	test("never costs more bits than single-mode encoding", () => {
		let random = createRandom(SEED);
		for (let iteration = 0; iteration < 500; iteration++) {
			let text = mixedText(random);
			let version = random.pick([1, 9, 10, 26, 27, 40]);
			expect(totalBits(textSegments(text, version), version)).toBeLessThanOrEqual(
				singleModeBits(text, version),
			);
		}
	});

	test("keeps every segment's count within its field", () => {
		let random = createRandom(`${SEED} counts`);
		for (let iteration = 0; iteration < 200; iteration++) {
			let text = mixedText(random).repeat(random.int(1, 20));
			let version = random.pick([1, 10, 27]);
			for (let segment of textSegments(text, version)) {
				expect(segment.count).toBeLessThan(2 ** charCountBits(segment.mode, version));
			}
		}
	});
});
