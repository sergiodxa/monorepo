import { readdirSync, readFileSync } from "node:fs";

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

/**
 * Runs the HTTP working group's structured-field-tests suite, vendored under
 * `fixtures/httpwg`, against `parse` and `stringify`: one Vitest case per fixture entry,
 * each checking the parsed model and the canonical serialization the suite expects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SF } from "./index.js";

import { Decimal, DisplayString, parse, stringify, Token } from "./index.js";

/** One entry of a fixture file, as the suite's README describes it. */
interface Fixture {
	name: string;
	raw?: string[];
	header_type: SF.FieldType;
	expected?: unknown;
	must_fail?: boolean;
	can_fail?: boolean;
	canonical?: string[];
}

/** The vendored suite's root; `serialisation-tests` sits inside it. */
const FIXTURES = new URL("./fixtures/httpwg/", import.meta.url);

/** RFC 4648 base32 alphabet, which the suite uses to carry Byte Sequences in JSON. */
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Decodes the suite's base32 Byte Sequence representation.
 *
 * @param text - Base32 text, `=` padded
 * @returns The bytes it carries
 */
function fromBase32(text: string): Uint8Array {
	let bits = 0;
	let buffer = 0;
	let bytes: number[] = [];
	for (let char of text.replace(/=+$/, "")) {
		buffer = (buffer << 5) | BASE32_ALPHABET.indexOf(char);
		bits += 5;
		if (bits >= 8) {
			bits -= 8;
			bytes.push((buffer >> bits) & 0xff);
		}
	}
	return new Uint8Array(bytes);
}

/**
 * Reads a fixture file, turning each JSON number written with a fraction or exponent into
 * a `Decimal` and each `__type` object into the package's type for it, so `1.0` stays a
 * Decimal where `JSON.parse` alone would make it the Integer `1`.
 *
 * @param url - The fixture file
 * @returns Its entries
 */
function readFixtures(url: URL): Fixture[] {
	let text = readFileSync(url, "utf8");
	return JSON.parse(text, (_key: string, value: unknown, context?: { source?: string }) => {
		if (typeof value === "number" && context?.source && /[.eE]/.test(context.source)) {
			return new Decimal(value);
		}
		if (typeof value === "object" && value !== null && "__type" in value && "value" in value) {
			let typed = value as { __type: string; value: unknown };
			if (typed.__type === "token") return new Token(String(typed.value));
			if (typed.__type === "binary") return fromBase32(String(typed.value));
			if (typed.__type === "date") return new Date(Number(typed.value) * 1000);
			if (typed.__type === "displaystring") return new DisplayString(String(typed.value));
		}
		return value;
	}) as Fixture[];
}

/**
 * Builds a null-prototype object from the suite's `[key, value]` pairs, the shape the
 * package gives Parameters and Dictionaries.
 *
 * @param pairs - Pairs in field order
 * @param map - Converts each value
 * @returns The ordered object
 */
function toRecord<T>(
	pairs: Array<[string, unknown]>,
	map: (value: unknown) => T,
): Record<string, T> {
	let record: Record<string, T> = Object.create(null);
	for (let [key, value] of pairs) record[key] = map(value);
	return record;
}

/**
 * Converts the suite's `[bareItem, params]` Item form.
 *
 * @param item - The pair
 * @returns The package's Item
 */
function toItem(item: unknown): SF.Item {
	let [value, params] = item as [SF.BareItem, Array<[string, SF.BareItem]>];
	return { value, params: toRecord(params, (bare) => bare as SF.BareItem) };
}

/**
 * Converts a List or Dictionary member, which is an Inner List when its first element is
 * itself an array of items.
 *
 * @param member - The suite's member form
 * @returns The package's Member
 */
function toMember(member: unknown): SF.Member {
	let [first, params] = member as [unknown, Array<[string, SF.BareItem]>];
	if (!Array.isArray(first)) return toItem(member);
	return {
		items: first.map(toItem),
		params: toRecord(params, (bare) => bare as SF.BareItem),
	};
}

/**
 * Converts a fixture's `expected` value into the package model for its field type.
 *
 * @param fixture - The fixture entry
 * @returns What `parse` should produce
 */
function toModel(fixture: Fixture): SF.ValueOf[SF.FieldType] {
	if (fixture.header_type === "item") return toItem(fixture.expected);
	if (fixture.header_type === "list") return (fixture.expected as unknown[]).map(toMember);
	return toRecord(fixture.expected as Array<[string, unknown]>, toMember);
}

/**
 * Lists the fixture files of a directory of the suite.
 *
 * @param directory - Directory inside the suite root
 * @returns Each file's name and URL
 */
function fixtureFiles(directory: string): Array<{ file: string; url: URL }> {
	let base = new URL(directory, FIXTURES);
	return readdirSync(base)
		.filter((file) => file.endsWith(".json"))
		.map((file) => ({ file, url: new URL(file, base) }));
}

describe.each(fixtureFiles("./"))("httpwg $file", ({ url }) => {
	test.each(readFixtures(url))("$name", (fixture) => {
		let parsed = parse((fixture.raw ?? []).join(", "), fixture.header_type);

		if (fixture.must_fail) {
			expect(isFailure(parsed)).toBe(true);
			return;
		}
		if (fixture.can_fail && isFailure(parsed)) return;

		if (isFailure(parsed)) throw parsed.error;
		let expected = toModel(fixture);
		expect(parsed.data).toStrictEqual(expected);

		let canonical = (fixture.canonical ?? fixture.raw ?? []).join(", ");
		let written = stringify(parsed.data, fixture.header_type);
		expect(isSuccess(written) && written.data).toBe(canonical);

		let fromExpected = stringify(expected, fixture.header_type);
		expect(isSuccess(fromExpected) && fromExpected.data).toBe(canonical);
	});
});

describe.each(fixtureFiles("./serialisation-tests/"))("httpwg serialisation $file", ({ url }) => {
	test.each(readFixtures(url))("$name", (fixture) => {
		let written = stringify(toModel(fixture), fixture.header_type);

		if (fixture.must_fail) {
			expect(isFailure(written)).toBe(true);
			return;
		}
		if (fixture.can_fail && isFailure(written)) return;

		expect(isSuccess(written) && written.data).toBe((fixture.canonical ?? []).join(", "));
	});
});
