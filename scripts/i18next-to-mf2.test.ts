/**
 * Tests for the i18next-to-MF2 codemod: pattern escaping, plural collapsing, `Trans` markup,
 * and in-place locale module rewrites that keep comments and `satisfies` intact.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { convertLocaleSource, convertPlural, convertSimple } from "./i18next-to-mf2.ts";

describe("convertSimple", () => {
	test("rewrites interpolations, tolerating whitespace", () => {
		expect(convertSimple("Hi {{name}} and {{ other }}", false).pattern).toBe(
			"Hi {$name} and {$other}",
		);
	});

	test("escapes MF2 special characters in text", () => {
		expect(convertSimple("a {b} \\ c", false).pattern).toBe("a \\{b\\} \\\\ c");
	});

	test("quotes a leading dot or whitespace", () => {
		expect(convertSimple(".env file", false).pattern).toBe("{|.|}env file");
		expect(convertSimple("...", false).pattern).toBe("{|...|}");
		expect(convertSimple(" x", false).pattern).toBe("{| |}x");
	});

	test("converts tags only for Trans keys", () => {
		expect(convertSimple("Read <a>{{title}}</a><br/>", true).pattern).toBe(
			"Read {#a}{$title}{/a}{#br /}",
		);
		expect(convertSimple("<code>x</code>", false).pattern).toBe("<code>x</code>");
	});

	test("reports formatted and dotted interpolations", () => {
		let formatted = convertSimple("{{n, number}}", false);
		expect(formatted.pattern).toBe("\\{\\{n, number\\}\\}");
		expect(formatted.issues).toHaveLength(1);
		let dotted = convertSimple("{{user.name}}", false);
		expect(dotted.pattern).toBe("{$user.name}");
		expect(dotted.issues).toHaveLength(1);
	});
});

describe("convertPlural", () => {
	test("emits a .match with zero as exact 0 and other as *", () => {
		expect(
			convertPlural({ zero: "none", one: "{{count}} item", other: "{{count}} items" }, false)
				.pattern,
		).toBe(
			".input {$count :number}\n.match $count\n0 {{none}}\none {{{$count} item}}\n* {{{$count} items}}",
		);
	});
});

describe("convertLocaleSource", () => {
	test("rewrites leaves and collapses plural groups in place", () => {
		let source = [
			"/** Header. */",
			"export default {",
			"\t/** Kept. */",
			"\tgreeting: 'Hi {{name}}',",
			'\tunread_one: "{{count}} unread",',
			'\tunread_other: "{{count}} unread",',
			'\tnested: { title: "<b>x</b>" },',
			'\tscopes: { read: "Read" } satisfies Record<string, string>,',
			"};",
		].join("\n");
		let result = convertLocaleSource(source, new Set(["nested.title"]));
		expect(result.output).toBe(
			[
				"/** Header. */",
				"export default {",
				"\t/** Kept. */",
				"\tgreeting: 'Hi {$name}',",
				'\tunread: ".input {$count :number}\\n.match $count\\none {{{$count} unread}}\\n* {{{$count} unread}}",',
				'\tnested: { title: "{#b}x{/b}" },',
				'\tscopes: { read: "Read" } satisfies Record<string, string>,',
				"};",
			].join("\n"),
		);
		expect(result.counts.pluralGroups).toBe(1);
	});

	test("reports groups it cannot collapse and stray angle brackets", () => {
		let source = 'export default { a: "x", a_one: "1", a_other: "n", b_one: "1", c: "<i>" };';
		let result = convertLocaleSource(source, new Set());
		expect(result.issues.map((issue) => issue.key)).toEqual(["a", "b"]);
		expect(result.angleBrackets).toEqual(["c"]);
		expect(result.output).toBe(source);
	});
});
