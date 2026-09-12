/**
 * Tests the escaper the round trip rests on: every character that could open a
 * construct, the two that depend on where the run sits, the line-start tracking
 * that decides the block markers, and the run measurement a fence sizes itself by.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { EscapeContext } from "./escape.js";

import { escapeText, longestRun } from "./escape.js";

/** Escapes a run with the mid-line, non-table default a case overrides one field of. */
function escape(value: string, context: Partial<EscapeContext> = {}): string {
	return escapeText(value, { lineStart: false, table: false, ...context });
}

describe("escapeText", () => {
	test("escapes the characters that open a construct wherever they sit", () => {
		expect(escape("a * b")).toBe("a \\* b");
		expect(escape("a _b_ c")).toBe("a \\_b\\_ c");
		expect(escape("a `b` c")).toBe("a \\`b\\` c");
		expect(escape("a [b] c")).toBe("a \\[b\\] c");
	});

	test("escapes a backslash so it stays one character after a second parse", () => {
		expect(escape("a \\ b")).toBe("a \\\\ b");
	});

	test("escapes a less-than sign on every run, without knowing what follows it", () => {
		expect(escape("a < b")).toBe("a \\< b");
		expect(escape("<Note>")).toBe("\\<Note>");
	});

	test("escapes a tilde, which opens strikethrough in this dialect", () => {
		expect(escape("~~gone~~")).toBe("\\~\\~gone\\~\\~");
	});

	test("escapes every tilde of a run, since one escape still leaves a pair behind it", () => {
		expect(escape("a ~ b")).toBe("a \\~ b");
		expect(escape("~~~")).toBe("\\~\\~\\~");
	});

	test("escapes the scheme of a bare URL, which needs no delimiter to become a link", () => {
		expect(escape("https://example.com")).toBe("https\\://example.com");
		expect(escape("http://example.com/a")).toBe("http\\://example.com/a");
		expect(escape("ftp://files.example.com")).toBe("ftp\\://files.example.com");
	});

	test("escapes the dot of a bare host, which GFM reads as a link without a scheme", () => {
		expect(escape("www.example.com")).toBe("www\\.example.com");
		expect(escape("WWW.Example.COM")).toBe("WWW\\.Example.COM");
	});

	test("escapes the at sign of a bare address, which GFM reads as a mail link", () => {
		expect(escape("a@b.com")).toBe("a\\@b.com");
		expect(escape("write to a.b+c@d.co.uk today")).toBe("write to a.b+c\\@d.co.uk today");
	});

	test("escapes only where a link could begin, since GFM needs a boundary in front of one", () => {
		expect(escape("awww.example.com")).toBe("awww.example.com");
		expect(escape("read (www.example.com) now")).toBe("read (www\\.example.com) now");
	});

	test("leaves an at sign that opens no address alone", () => {
		expect(escape("ask @sdxc about it")).toBe("ask @sdxc about it");
		expect(escape("sergio @ home")).toBe("sergio @ home");
	});

	test("leaves the punctuation of ordinary prose alone", () => {
		expect(escape("Plans start at $5/month.")).toBe("Plans start at $5/month.");
		expect(escape("See section 3.2.")).toBe("See section 3.2.");
		expect(escape("What follows: three things.")).toBe("What follows: three things.");
	});

	test("leaves a character that opens nothing alone", () => {
		expect(escape("plain words, 100% of them")).toBe("plain words, 100% of them");
	});

	test("escapes a block marker that opens a line", () => {
		expect(escape("# not a heading", { lineStart: true })).toBe("\\# not a heading");
		expect(escape("> not a quote", { lineStart: true })).toBe("\\> not a quote");
		expect(escape("+ not a bullet", { lineStart: true })).toBe("\\+ not a bullet");
		expect(escape("- not a bullet", { lineStart: true })).toBe("\\- not a bullet");
		expect(escape("= not a heading", { lineStart: true })).toBe("\\= not a heading");
	});

	test("leaves a block marker alone once the line is underway", () => {
		expect(escape("a # b > c - d + e = f")).toBe("a # b > c - d + e = f");
	});

	test("escapes an ordered marker on its delimiter, since a digit cannot carry one", () => {
		expect(escape("1. not a list", { lineStart: true })).toBe("1\\. not a list");
		expect(escape("2) not a list", { lineStart: true })).toBe("2\\) not a list");
	});

	test("escapes an ordered marker however many digits it counts to", () => {
		expect(escape("1024. not a list", { lineStart: true })).toBe("1024\\. not a list");
	});

	test("leaves an ordered marker alone once the line is underway", () => {
		expect(escape("step 1. then two")).toBe("step 1. then two");
	});

	test("escapes the annotation opener so a brace pair never becomes a hole", () => {
		expect(escape("{% $name %}")).toBe("\\{% $name %}");
	});

	test("leaves a brace alone when no percent sign follows it", () => {
		expect(escape("{ name }")).toBe("{ name }");
	});

	test("escapes a pipe inside a table cell and leaves it alone outside one", () => {
		expect(escape("a | b", { table: true })).toBe("a \\| b");
		expect(escape("a | b")).toBe("a | b");
	});

	test("keeps a run at the line start through the whitespace that indents it", () => {
		expect(escape("  # indented", { lineStart: true })).toBe("  \\# indented");
		expect(escape("\t- indented", { lineStart: true })).toBe("\t\\- indented");
	});

	test("puts the run back at a line start after a newline", () => {
		expect(escape("prose\n# not a heading")).toBe("prose\n\\# not a heading");
	});

	test("leaves the line start behind once a word has been written", () => {
		expect(escape("a - b", { lineStart: true })).toBe("a - b");
	});

	test("escapes the marker that opens every line of a multi-line run", () => {
		expect(escape("- one\n- two", { lineStart: true })).toBe("\\- one\n\\- two");
	});

	test("restores the escape only for a marker that opens the next line", () => {
		expect(escape("# mid-run\ntext # inline")).toBe("# mid-run\ntext # inline");
		expect(escape("# mid-run\n# opener")).toBe("# mid-run\n\\# opener");
	});

	test("writes an empty run as an empty string", () => {
		expect(escape("")).toBe("");
	});
});

describe("longestRun", () => {
	test("measures the longest unbroken run in the middle of a value", () => {
		expect(longestRun("a ``b`` c ` d", "`")).toBe(2);
	});

	test("measures a run that opens the value", () => {
		expect(longestRun("```a`", "`")).toBe(3);
	});

	test("measures a run that closes the value", () => {
		expect(longestRun("`a```", "`")).toBe(3);
	});

	test("counts nothing when the character never appears", () => {
		expect(longestRun("plain text", "`")).toBe(0);
	});

	test("counts nothing in an empty value", () => {
		expect(longestRun("", "`")).toBe(0);
	});

	test("measures whichever character it is asked about", () => {
		expect(longestRun("~~~ and ``", "~")).toBe(3);
		expect(longestRun("~~~ and ``", "`")).toBe(2);
	});
});
