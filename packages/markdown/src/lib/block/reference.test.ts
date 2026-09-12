/**
 * Reading a link reference definition off the front of a paragraph, and the two
 * ways a label is folded. The cases are the forms a definition may take, the
 * near-misses that stay paragraph text, and what each fold is for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { normalizeLabel } from "../inline.js";

import { normalizeIdentifier, readDefinition } from "./reference.js";

describe("the destination", () => {
	test("reads a definition that carries nothing but a destination", () => {
		expect(readDefinition("[ref]: /target\n", 0)).toMatchObject({
			label: "ref",
			href: "/target",
		});
	});

	test("reads a destination the definition holds in angle brackets", () => {
		expect(readDefinition("[ref]: <the target>\n", 0)).toMatchObject({ href: "the target" });
	});

	test("reads an empty destination written as a pair of angle brackets", () => {
		expect(readDefinition("[ref]: <>\n", 0)).toMatchObject({ href: "" });
	});

	test("keeps parentheses that balance inside a bare destination", () => {
		expect(readDefinition("[ref]: /foo(bar(baz))\n", 0)).toMatchObject({
			href: "/foo(bar(baz))",
		});
	});

	test("rejects a bare destination whose parentheses do not balance", () => {
		expect(readDefinition("[ref]: /foo(bar\n", 0)).toBe(null);
		expect(readDefinition("[ref]: /foo)bar\n", 0)).toBe(null);
	});

	test("rejects an angle-bracketed destination that runs past its line", () => {
		expect(readDefinition("[ref]: <a\nb>\n", 0)).toBe(null);
	});

	test("reads a destination on the line below the label", () => {
		expect(readDefinition("[ref]:\n  /target\n", 0)).toMatchObject({ href: "/target" });
	});

	test("rejects a destination a blank line separates from the label", () => {
		expect(readDefinition("[ref]:\n\n/target\n", 0)).toBe(null);
	});
});

describe("the title", () => {
	test("reads a title in each of the three forms a title may be quoted in", () => {
		expect(readDefinition('[ref]: /target "Title"\n', 0)).toMatchObject({ title: "Title" });
		expect(readDefinition("[ref]: /target 'Title'\n", 0)).toMatchObject({ title: "Title" });
		expect(readDefinition("[ref]: /target (Title)\n", 0)).toMatchObject({ title: "Title" });
	});

	test("reads a title written on the line below the destination", () => {
		let definition = readDefinition('[ref]: /target\n   "Title"\nprose\n', 0);

		expect(definition).toMatchObject({ href: "/target", title: "Title" });
		expect(definition?.end).toBe(26);
	});

	test("keeps the definition untitled when a blank line separates the two", () => {
		let definition = readDefinition('[ref]: /target\n\n"Title"\n', 0);

		expect(definition).toMatchObject({ href: "/target" });
		expect(definition?.title).toBeUndefined();
	});

	test("rejects a parenthesized title holding a parenthesis of its own", () => {
		expect(readDefinition("[ref]: /a (ti(tle)\n", 0)).toBe(null);
	});

	test("rejects a title the line ends before closing", () => {
		expect(readDefinition('[ref]: /target "unclosed\n', 0)).toBe(null);
	});
});

describe("what the definition resolves", () => {
	test("resolves a backslash escape in the destination and in the title", () => {
		expect(readDefinition('[ref]: /foo\\+bar "a \\"quote\\""\n', 0)).toMatchObject({
			href: "/foo+bar",
			title: 'a "quote"',
		});
	});

	test("resolves a character reference in the destination and in the title", () => {
		expect(readDefinition('[ref]: /f&ouml;&ouml; "f&ouml;&ouml;"\n', 0)).toMatchObject({
			href: "/föö",
			title: "föö",
		});
	});

	test("hands the label back as written, for the caller to fold as it needs", () => {
		expect(readDefinition("[Foo Bar]: /a\n", 0)).toMatchObject({ label: "Foo Bar" });
	});
});

describe("text that is no definition", () => {
	test("rejects a paragraph that opens with no bracket at all", () => {
		expect(readDefinition("not a definition\n", 0)).toBe(null);
	});

	test("rejects a label the colon does not immediately follow", () => {
		expect(readDefinition("[ref] /target\n", 0)).toBe(null);
		expect(readDefinition("[ref] : /target\n", 0)).toBe(null);
	});

	test("rejects a label holding a bracket of its own", () => {
		expect(readDefinition("[a[b]]: /a\n", 0)).toBe(null);
	});

	test("rejects a label with nothing but whitespace in it", () => {
		expect(readDefinition("[]: /a\n", 0)).toBe(null);
		expect(readDefinition("[  ]: /a\n", 0)).toBe(null);
	});

	test("rejects a label longer than the limit CommonMark reads", () => {
		expect(readDefinition(`[${"a".repeat(1000)}]: /a\n`, 0)).toBe(null);
		expect(readDefinition(`[${"a".repeat(999)}]: /a\n`, 0)).toMatchObject({ href: "/a" });
	});

	test("rejects a line carrying content past the definition", () => {
		expect(readDefinition('[ref]: /target "Title" extra\n', 0)).toBe(null);
	});
});

describe("where the definition ends", () => {
	test("ends at the start of the next line, which is where the next one is read from", () => {
		let text = "[a]: /a\n[b]: /b\nprose\n";
		let first = readDefinition(text, 0);

		expect(first).toMatchObject({ label: "a", href: "/a", end: 8 });

		let second = readDefinition(text, first?.end ?? 0);

		expect(second).toMatchObject({ label: "b", href: "/b", end: 16 });
		expect(readDefinition(text, second?.end ?? 0)).toBe(null);
	});

	test("ends at the end of the text when no line follows the definition", () => {
		expect(readDefinition("[ref]: /target", 0)).toMatchObject({ end: 14 });
	});
});

describe("folding a label", () => {
	test("collapses a run of whitespace to one space and drops what surrounds it", () => {
		expect(normalizeLabel("  Foo \t\n  Bar  ")).toBe("FOO BAR");
		expect(normalizeIdentifier("  Foo \t\n  Bar  ")).toBe("foo bar");
	});

	test("case folds a reference label, so two spellings of one word meet", () => {
		expect(normalizeLabel("ẞ")).toBe(normalizeLabel("ss"));
		expect(normalizeLabel("ΣΣ")).toBe(normalizeLabel("σς"));
	});

	test("only lowercases a footnote identifier, keeping it readable as an anchor", () => {
		expect(normalizeIdentifier("Note 1")).toBe("note 1");
		expect(normalizeIdentifier("Толпой")).toBe("толпой");
	});

	test("leaves a footnote identifier out of the fold a reference label goes through", () => {
		expect(normalizeIdentifier("ẞ")).not.toBe(normalizeIdentifier("ss"));
	});
});
