/**
 * Checks the content-line layer (RFC 5545 §3.1 and RFC 6868): unfolding with line numbers,
 * folding at 75 octets without splitting a character, parameter quoting and caret encoding,
 * and the malformed lines a reader refuses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { fold, formatContentLine, parseContentLine, unfold } from "./content-line.js";

/**
 * The UTF-8 length of a string, the unit folding counts in.
 *
 * @param text - Text to measure
 * @returns Its size in octets
 */
function octets(text: string): number {
	return new TextEncoder().encode(text).length;
}

describe("unfold", () => {
	test("joins continuation lines and removes one leading whitespace character", () => {
		let lines = unfold(
			"DESCRIPTION:This is a lo\r\n ng description\r\n\t that exists\r\nUID:1\r\n",
		);
		expect(lines).toEqual([
			{ text: "DESCRIPTION:This is a long description that exists", line: 1 },
			{ text: "UID:1", line: 4 },
		]);
	});

	test("accepts bare LF line endings and skips blank lines", () => {
		expect(unfold("A:1\n\nB:2\n")).toEqual([
			{ text: "A:1", line: 1 },
			{ text: "B:2", line: 3 },
		]);
	});

	test("strips a byte order mark", () => {
		expect(unfold("﻿BEGIN:VCALENDAR")).toEqual([{ text: "BEGIN:VCALENDAR", line: 1 }]);
	});
});

describe("fold", () => {
	test("leaves a line of exactly 75 octets whole", () => {
		let line = "X".repeat(75);
		expect(fold(line)).toBe(line);
	});

	test("folds the 76th octet onto a continuation line", () => {
		expect(fold("X".repeat(76))).toBe(`${"X".repeat(75)}\r\n X`);
	});

	test("keeps every folded line within 75 octets, the leading space included", () => {
		let folded = fold(`DESCRIPTION:${"abcdefghij".repeat(30)}`);
		for (let line of folded.split("\r\n")) expect(octets(line)).toBeLessThanOrEqual(75);
		expect(unfold(folded)[0]?.text).toBe(`DESCRIPTION:${"abcdefghij".repeat(30)}`);
	});

	test("moves a multi-byte character that would straddle the boundary to the next line", () => {
		let line = `${"X".repeat(74)}é`;
		let folded = fold(line);
		expect(folded).toBe(`${"X".repeat(74)}\r\n é`);
		expect(unfold(folded)[0]?.text).toBe(line);
	});

	test("never splits four-byte characters", () => {
		let line = `SUMMARY:${"🗓️".repeat(40)}`;
		let folded = fold(line);
		for (let physical of folded.split("\r\n")) {
			expect(octets(physical)).toBeLessThanOrEqual(75);
			expect(physical).not.toMatch(/�/);
		}
		expect(unfold(folded)[0]?.text).toBe(line);
	});
});

describe("parseContentLine", () => {
	test("reads the name, parameters and value", () => {
		let property = unwrap(
			parseContentLine("attendee;RSVP=TRUE;role=REQ-PARTICIPANT:mailto:a@example.com"),
		);
		expect(property).toEqual({
			name: "ATTENDEE",
			parameters: { RSVP: ["TRUE"], ROLE: ["REQ-PARTICIPANT"] },
			value: "mailto:a@example.com",
		});
	});

	test("keeps colons in the value", () => {
		expect(unwrap(parseContentLine("URL:http://example.com:8080/a")).value).toBe(
			"http://example.com:8080/a",
		);
	});

	test("reads quoted parameter values containing separators", () => {
		let property = unwrap(
			parseContentLine('ATTENDEE;CN="Doe, Jane";DELEGATED-TO="mailto:a@x","mailto:b@x":mailto:c@x'),
		);
		expect(property.parameters).toEqual({
			CN: ["Doe, Jane"],
			"DELEGATED-TO": ["mailto:a@x", "mailto:b@x"],
		});
	});

	test("decodes RFC 6868 carets", () => {
		let property = unwrap(
			parseContentLine(
				'ATTENDEE;X-ADDRESS="Pittsburgh Pirates^n115 Federal St^nPittsburgh, PA 15212":mailto:a@x',
			),
		);
		expect(property.parameters["X-ADDRESS"]).toEqual([
			"Pittsburgh Pirates\n115 Federal St\nPittsburgh, PA 15212",
		]);
		expect(unwrap(parseContentLine("X-A;CN=^'Jo^' ^^:v")).parameters.CN).toEqual(['"Jo" ^']);
	});

	test("leaves an unknown caret sequence as written", () => {
		expect(unwrap(parseContentLine("X-A;CN=a^b:v")).parameters.CN).toEqual(["a^b"]);
	});

	test("refuses a line without a colon", () => {
		let result = parseContentLine("SUMMARY;LANGUAGE=en");
		expect(isFailure(result)).toBe(true);
	});

	test("refuses a line without a name", () => {
		expect(isFailure(parseContentLine(":value"))).toBe(true);
	});

	test("refuses an unterminated quoted parameter", () => {
		expect(isFailure(parseContentLine('X-A;CN="open:value'))).toBe(true);
	});
});

describe("formatContentLine", () => {
	test("quotes parameter values containing a colon, semicolon or comma", () => {
		expect(
			formatContentLine({
				name: "attendee",
				parameters: { cn: ["Doe, Jane"], "DELEGATED-TO": ["mailto:a@x"] },
				value: "mailto:c@x",
			}),
		).toBe('ATTENDEE;CN="Doe, Jane";DELEGATED-TO="mailto:a@x":mailto:c@x');
	});

	test("caret-encodes newlines, quotes and carets", () => {
		let line = formatContentLine({
			name: "X-A",
			parameters: { CN: ['Line one\nsays "hi" ^'] },
			value: "v",
		});
		expect(line).toBe("X-A;CN=Line one^nsays ^'hi^' ^^:v");
		expect(unwrap(parseContentLine(line)).parameters.CN).toEqual(['Line one\nsays "hi" ^']);
	});

	test("skips parameters without values and folds the result", () => {
		let line = formatContentLine({
			name: "DESCRIPTION",
			parameters: { LANGUAGE: [] },
			value: "x".repeat(100),
		});
		expect(line.startsWith("DESCRIPTION:")).toBe(true);
		expect(line).toContain("\r\n ");
	});
});
