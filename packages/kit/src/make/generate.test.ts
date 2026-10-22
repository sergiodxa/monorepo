/**
 * The string literals `sdxc make` splices into generated source: every value reads back as
 * itself and none can close a script element or split the line it is written on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vite-plus/test";

import { literal, memberAccess } from "./generate.js";

describe("literal", () => {
	test("writes a plain specifier as a double-quoted string", () => {
		expect(literal("~/app/jobs/send-digest")).toBe('"~/app/jobs/send-digest"');
	});

	test("escapes angle brackets and Unicode line separators", () => {
		let value = "</script>\u2028\u2029";
		let written = literal(value);
		expect(written).toBe('"\\u003C/script\\u003E\\u2028\\u2029"');
		expect(JSON.parse(written)).toBe(value);
	});
});

describe("memberAccess", () => {
	test("quotes a segment that is no identifier through the same literal", () => {
		expect(memberAccess(["users", "send-digest"])).toBe('.users["send-digest"]');
	});
});
