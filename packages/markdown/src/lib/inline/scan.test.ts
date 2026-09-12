/**
 * Checks the inline phase's scanning primitives one reader at a time: delimiter
 * flanking, link destinations, titles and labels, raw HTML, both autolink
 * families, and the two foldings a label is looked up by. Every reader reports
 * where it stopped, so each case pins the index beside the value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import {
	isEscapable,
	matchAutolink,
	matchDestination,
	matchHtmlTag,
	matchLabel,
	matchLiteralEmail,
	matchLiteralUrl,
	matchTitle,
	normalizeIdentifier,
	normalizeLabel,
	scanDelimiterRun,
	skipSpaceAndNewline,
	unescapeString,
} from "./scan.js";

describe("delimiter runs", () => {
	test("measures how many characters the run spans", () => {
		expect(scanDelimiterRun("***a", 0, 4).length).toBe(3);
		expect(scanDelimiterRun("~~a", 0, 3).length).toBe(2);
	});

	test("a run before a word may only open", () => {
		expect(scanDelimiterRun("*foo*", 0, 5)).toEqual({ length: 1, canOpen: true, canClose: false });
	});

	test("a run after a word may only close", () => {
		expect(scanDelimiterRun("*foo*", 4, 5)).toEqual({ length: 1, canOpen: false, canClose: true });
	});

	test("a run with whitespace on both sides may do neither", () => {
		expect(scanDelimiterRun("a * b", 2, 5)).toEqual({ length: 1, canOpen: false, canClose: false });
	});

	test("a run before punctuation may only close", () => {
		expect(scanDelimiterRun("a*.", 1, 3)).toEqual({ length: 1, canOpen: false, canClose: true });
	});

	test("a run after an opening parenthesis may only open", () => {
		expect(scanDelimiterRun("(*a", 1, 3)).toEqual({ length: 1, canOpen: true, canClose: false });
	});

	test("an asterisk run inside a word may take either end", () => {
		expect(scanDelimiterRun("foo*bar*baz", 3, 11)).toEqual({
			length: 1,
			canOpen: true,
			canClose: true,
		});
		expect(scanDelimiterRun("a**b", 1, 4)).toEqual({ length: 2, canOpen: true, canClose: true });
	});

	test("an underscore run inside a word may take neither end", () => {
		expect(scanDelimiterRun("foo_bar_baz", 3, 11)).toEqual({
			length: 1,
			canOpen: false,
			canClose: false,
		});
	});

	test("an underscore run beside a word takes the end the word is not on", () => {
		expect(scanDelimiterRun("_foo_", 0, 5)).toEqual({ length: 1, canOpen: true, canClose: false });
		expect(scanDelimiterRun("_foo_", 4, 5)).toEqual({ length: 1, canOpen: false, canClose: true });
	});

	test("an underscore run preceded by punctuation may open even though it also closes", () => {
		expect(scanDelimiterRun("_(_foo_)_", 2, 9)).toEqual({
			length: 1,
			canOpen: true,
			canClose: false,
		});
	});

	test("the end of the range reads as a line ending rather than as the next character", () => {
		expect(scanDelimiterRun("***", 0, 2)).toEqual({ length: 2, canOpen: false, canClose: false });
	});

	test("unicode punctuation counts as punctuation", () => {
		expect(scanDelimiterRun("—*a*", 1, 4)).toEqual({
			length: 1,
			canOpen: true,
			canClose: false,
		});
	});
});

describe("raw inline HTML", () => {
	test("reads an open tag and reports the index one past it", () => {
		expect(matchHtmlTag("<a href='x'>b", 0, 13)).toBe(12);
		expect(matchHtmlTag("<a b=c>x", 0, 8)).toBe(7);
		expect(matchHtmlTag('<a b="c d">x', 0, 12)).toBe(11);
		expect(matchHtmlTag("<a disabled>x", 0, 13)).toBe(12);
	});

	test("reads a self-closing tag", () => {
		expect(matchHtmlTag("<br/>", 0, 5)).toBe(5);
	});

	test("reads a closing tag, spaces before its bracket included", () => {
		expect(matchHtmlTag("</span> x", 0, 9)).toBe(7);
		expect(matchHtmlTag("</a >x", 0, 6)).toBe(5);
	});

	test("reads a comment in each of the three forms", () => {
		expect(matchHtmlTag("<!-- hi -->x", 0, 12)).toBe(11);
		expect(matchHtmlTag("<!-->x", 0, 6)).toBe(5);
		expect(matchHtmlTag("<!--->x", 0, 7)).toBe(6);
	});

	test("reads a processing instruction", () => {
		expect(matchHtmlTag("<?php echo ?>x", 0, 14)).toBe(13);
	});

	test("reads a declaration", () => {
		expect(matchHtmlTag("<!DOCTYPE html>x", 0, 16)).toBe(15);
	});

	test("reads a CDATA section", () => {
		expect(matchHtmlTag("<![CDATA[a]]>x", 0, 14)).toBe(13);
	});

	test("reads from part way into the text", () => {
		expect(matchHtmlTag("x<br/>y", 1, 7)).toBe(6);
	});

	test("a bracket the text never closes is not HTML", () => {
		expect(matchHtmlTag("< a>", 0, 4)).toBe(-1);
		expect(matchHtmlTag("<1a>", 0, 4)).toBe(-1);
	});

	test("a tag reaching past the range is not HTML", () => {
		expect(matchHtmlTag("<br/>", 0, 4)).toBe(-1);
	});
});

describe("autolinks in angle brackets", () => {
	test("reads an absolute URI as its own label", () => {
		expect(matchAutolink("<http://a.com/b?c>x", 0, 19)).toEqual({
			href: "http://a.com/b?c",
			label: "http://a.com/b?c",
			end: 18,
		});
	});

	test("gives an email address the mailto scheme and shows it without one", () => {
		expect(matchAutolink("<a@b.com>x", 0, 10)).toEqual({
			href: "mailto:a@b.com",
			label: "a@b.com",
			end: 9,
		});
	});

	test("a URI holding a space is not an autolink", () => {
		expect(matchAutolink("<http://a b>", 0, 12)).toBeNull();
	});

	test("a bracketed word with no scheme is not an autolink", () => {
		expect(matchAutolink("<foo>", 0, 5)).toBeNull();
	});

	test("an autolink reaching past the range is not read", () => {
		expect(matchAutolink("<a@b.com>", 0, 5)).toBeNull();
	});
});

describe("link destinations", () => {
	test("reads a bare destination up to the first space", () => {
		expect(matchDestination("a b", 0, 3)).toEqual({ href: "a", end: 1 });
	});

	test("reads a bare destination beginning part way into the text", () => {
		expect(matchDestination("](/x) ", 2, 5)).toEqual({ href: "/x", end: 4 });
	});

	test("keeps parentheses the destination balances", () => {
		expect(matchDestination("a(b)c)", 0, 6)).toEqual({ href: "a(b)c", end: 5 });
	});

	test("stops at a closing parenthesis the destination never opened", () => {
		expect(matchDestination("/uri)", 0, 5)).toEqual({ href: "/uri", end: 4 });
	});

	test("reads an empty destination when the parenthesis closes at once", () => {
		expect(matchDestination(")", 0, 1)).toEqual({ href: "", end: 0 });
	});

	test("an escaped parenthesis neither opens nor closes a pair", () => {
		expect(matchDestination("a\\(b", 0, 4)).toEqual({ href: "a(b", end: 4 });
	});

	test("ends at an ASCII control character as well as at a space", () => {
		expect(matchDestination("a\tb", 0, 3)).toEqual({ href: "a", end: 1 });
		expect(matchDestination("ab", 0, 3)).toEqual({ href: "a", end: 1 });
	});

	test("a space above the ASCII range belongs to the destination", () => {
		expect(matchDestination("a b", 0, 3)).toEqual({ href: "a b", end: 3 });
	});

	test("resolves escapes and character references into the href", () => {
		expect(matchDestination("a&amp;b", 0, 7)).toEqual({ href: "a&b", end: 7 });
	});

	test("reads a pointy-bracket destination holding spaces", () => {
		expect(matchDestination("<a b>c", 0, 6)).toEqual({ href: "a b", end: 5 });
	});

	test("an escaped bracket stays inside a pointy-bracket destination", () => {
		expect(matchDestination("<a\\>b>", 0, 6)).toEqual({ href: "a>b", end: 6 });
	});

	test("a pointy bracket the line never closes holds no destination", () => {
		expect(matchDestination("<ab", 0, 3)).toBeNull();
		expect(matchDestination("<a\nb>", 0, 5)).toBeNull();
	});

	test("nests parentheses to the depth the scan allows", () => {
		let deepest = `${"(".repeat(32)}${")".repeat(32)}`;

		expect(matchDestination(deepest, 0, deepest.length)).toEqual({
			href: deepest,
			end: deepest.length,
		});
	});

	test("gives up one level past the depth the scan allows", () => {
		let tooDeep = `${"(".repeat(33)}${")".repeat(33)}`;

		expect(matchDestination(tooDeep, 0, tooDeep.length)).toBeNull();
	});

	test("gives up on a parenthesis run the text never closes rather than reading it all", () => {
		let unclosed = `b${"(".repeat(200)}`;

		expect(matchDestination(unclosed, 0, unclosed.length)).toBeNull();
		expect(matchDestination("a(b", 0, 3)).toBeNull();
	});

	test("a parenthesis left open at the end of the range holds no destination", () => {
		expect(matchDestination("a(b)c", 0, 3)).toBeNull();
	});
});

describe("link titles", () => {
	test("reads a title in double quotes", () => {
		expect(matchTitle('"a" x', 0, 5)).toEqual({ title: "a", end: 3 });
	});

	test("reads a title in single quotes", () => {
		expect(matchTitle("'a' x", 0, 5)).toEqual({ title: "a", end: 3 });
	});

	test("reads a title in parentheses", () => {
		expect(matchTitle("(a) x", 0, 5)).toEqual({ title: "a", end: 3 });
	});

	test("reads an empty title", () => {
		expect(matchTitle('"" x', 0, 4)).toEqual({ title: "", end: 2 });
	});

	test("reads a title beginning part way into the text", () => {
		expect(matchTitle('x "t"', 2, 5)).toEqual({ title: "t", end: 5 });
	});

	test("resolves escapes and character references into the title", () => {
		expect(matchTitle('"a\\"b"', 0, 6)).toEqual({ title: 'a"b', end: 6 });
		expect(matchTitle('"a&amp;b"', 0, 9)).toEqual({ title: "a&b", end: 9 });
	});

	test("a parenthesized title may hold a parenthesis only when it is escaped", () => {
		expect(matchTitle("(a(b)c)", 0, 7)).toBeNull();
		expect(matchTitle("(a\\(b)", 0, 6)).toEqual({ title: "a(b", end: 6 });
	});

	test("a quote the line never closes holds no title", () => {
		expect(matchTitle('"abc', 0, 4)).toBeNull();
		expect(matchTitle("a", 0, 1)).toBeNull();
	});

	test("a title reaching past the range is not read", () => {
		expect(matchTitle('"t"', 0, 2)).toBeNull();
		expect(matchTitle("(t)", 0, 2)).toBeNull();
	});
});

describe("link labels", () => {
	test("counts the brackets along with what they hold", () => {
		expect(matchLabel("[foo] bar", 0, 9)).toBe(5);
		expect(matchLabel("[]", 0, 2)).toBe(2);
	});

	test("an escaped bracket stays inside the label", () => {
		expect(matchLabel("[a\\]b]", 0, 6)).toBe(6);
	});

	test("a bracket the line never closes spans nothing", () => {
		expect(matchLabel("[foo", 0, 4)).toBe(0);
	});

	test("a label reaching past the range spans nothing", () => {
		expect(matchLabel("[foo]", 0, 3)).toBe(0);
	});

	test("a label holds at most a thousand characters", () => {
		let longest = `[${"a".repeat(1000)}]`;
		let tooLong = `[${"a".repeat(1001)}]`;

		expect(matchLabel(longest, 0, longest.length)).toBe(1002);
		expect(matchLabel(tooLong, 0, tooLong.length)).toBe(0);
	});
});

describe("skipping space and one line ending", () => {
	test("skips a run of spaces and tabs", () => {
		expect(skipSpaceAndNewline("a   b", 1, 5)).toBe(4);
	});

	test("crosses one line ending along with the spaces on both sides of it", () => {
		expect(skipSpaceAndNewline("a   \n  b", 1, 8)).toBe(7);
	});

	test("stops at the second line ending", () => {
		expect(skipSpaceAndNewline("a \n \n b", 1, 7)).toBe(4);
	});

	test("never reaches past the end of the range", () => {
		expect(skipSpaceAndNewline("a   b", 1, 2)).toBe(2);
	});
});

describe("backslash escapes", () => {
	test("a backslash escapes ASCII punctuation and nothing else", () => {
		expect(isEscapable("*")).toBe(true);
		expect(isEscapable("\\")).toBe(true);
		expect(isEscapable("a")).toBe(false);
		expect(isEscapable("é")).toBe(false);
	});

	test("nothing past the end of the text is escapable", () => {
		expect(isEscapable(undefined)).toBe(false);
	});

	test("unescaping writes the character the backslash stood before", () => {
		expect(unescapeString("a\\*b")).toBe("a*b");
		expect(unescapeString("a\\\\b")).toBe("a\\b");
	});

	test("a backslash before anything unescapable stays in the text", () => {
		expect(unescapeString("a\\qb")).toBe("a\\qb");
		expect(unescapeString("a\\\nb")).toBe("a\\\nb");
	});

	test("unescaping resolves the character references it passes", () => {
		expect(unescapeString("&amp;")).toBe("&");
		expect(unescapeString("&#65;&nope;")).toBe("A&nope;");
	});
});

describe("label normalization", () => {
	test("a label trims, collapses its whitespace, and folds its case", () => {
		expect(normalizeLabel("  Foo\t Bar\n baz  ")).toBe("FOO BAR BAZ");
		expect(normalizeLabel("a\t\tb")).toBe("A B");
	});

	test("a label folds the characters whose uppercase is longer than they are", () => {
		expect(normalizeLabel("ẞ")).toBe("SS");
		expect(normalizeLabel("ß")).toBe("SS");
	});

	test("an identifier trims and collapses its whitespace, and only lowercases", () => {
		expect(normalizeIdentifier("  Foo\t Bar\n baz  ")).toBe("foo bar baz");
		expect(normalizeIdentifier("A\t\tB")).toBe("a b");
	});

	test("an identifier keeps a character the case fold would have replaced", () => {
		expect(normalizeIdentifier("ẞ")).toBe("ß");
	});
});

describe("literal URL autolinks", () => {
	test("gives a bare host the http scheme while showing it without one", () => {
		expect(matchLiteralUrl("www.a.com/b", 0, 0, 11)).toEqual({
			href: "http://www.a.com/b",
			label: "www.a.com/b",
			end: 11,
		});
	});

	test("keeps the scheme the source wrote, in the case it wrote it", () => {
		expect(matchLiteralUrl("http://a.com", 0, 0, 12)).toEqual({
			href: "http://a.com",
			label: "http://a.com",
			end: 12,
		});
		expect(matchLiteralUrl("ftp://a.com", 0, 0, 11)).toEqual({
			href: "ftp://a.com",
			label: "ftp://a.com",
			end: 11,
		});
		expect(matchLiteralUrl("HTTP://A.com", 0, 0, 12)).toEqual({
			href: "HTTP://A.com",
			label: "HTTP://A.com",
			end: 12,
		});
	});

	test("sentence punctuation at the end belongs to the prose, not to the link", () => {
		expect(matchLiteralUrl("https://a.com.", 0, 0, 14)).toEqual({
			href: "https://a.com",
			label: "https://a.com",
			end: 13,
		});
		expect(matchLiteralUrl("http://a.com/b.,", 0, 0, 16)).toEqual({
			href: "http://a.com/b",
			label: "http://a.com/b",
			end: 14,
		});
		expect(matchLiteralUrl("http://a.com!", 0, 0, 13)?.end).toBe(12);
		expect(matchLiteralUrl("www.a.com~", 0, 0, 10)?.end).toBe(9);
	});

	test("a closing parenthesis the link never opened belongs to the prose", () => {
		expect(matchLiteralUrl("http://a.com/b)", 0, 0, 15)).toEqual({
			href: "http://a.com/b",
			label: "http://a.com/b",
			end: 14,
		});
	});

	test("a closing parenthesis the link opened stays in it", () => {
		expect(matchLiteralUrl("http://a.com/(b)", 0, 0, 16)).toEqual({
			href: "http://a.com/(b)",
			label: "http://a.com/(b)",
			end: 16,
		});
	});

	test("a character reference at the end is dropped whole", () => {
		expect(matchLiteralUrl("http://a.com/&amp;", 0, 0, 18)).toEqual({
			href: "http://a.com/",
			label: "http://a.com/",
			end: 13,
		});
	});

	test("a host with no dot in it is not a link", () => {
		expect(matchLiteralUrl("http://localhost/x", 0, 0, 18)).toBeNull();
	});

	test("a host with an empty label in it is not a link", () => {
		expect(matchLiteralUrl("http://a..com", 0, 0, 13)).toBeNull();
	});

	test("an underscore keeps a host out of the last two labels only", () => {
		expect(matchLiteralUrl("http://a_b.c.com", 0, 0, 16)?.label).toBe("http://a_b.c.com");
		expect(matchLiteralUrl("http://a.b_c.com", 0, 0, 16)).toBeNull();
	});

	test("a scheme written inside a word is prose", () => {
		expect(matchLiteralUrl("xwww.a.com", 1, 0, 10)).toBeNull();
	});

	test("a delimiter or an opening parenthesis may sit right before the link", () => {
		expect(matchLiteralUrl("(www.a.com", 1, 0, 10)?.label).toBe("www.a.com");
		expect(matchLiteralUrl("~www.a.com", 1, 0, 10)?.label).toBe("www.a.com");
	});

	test("the start of the range is a boundary of its own", () => {
		expect(matchLiteralUrl("zzwww.a.com", 2, 2, 11)?.label).toBe("www.a.com");
	});

	test("a scheme with nothing after it is not a link", () => {
		expect(matchLiteralUrl("www.", 0, 0, 4)).toBeNull();
	});

	test("the link stops at the end of the range", () => {
		expect(matchLiteralUrl("http://a.com/xyz", 0, 0, 12)).toEqual({
			href: "http://a.com",
			label: "http://a.com",
			end: 12,
		});
	});

	test("a quote closing the prose around a link stays part of the link", () => {
		expect(matchLiteralUrl("http://a.com'", 0, 0, 13)).toEqual({
			href: "http://a.com'",
			label: "http://a.com'",
			end: 13,
		});

		expect(matchLiteralUrl('http://a.com"', 0, 0, 13)).toEqual({
			href: 'http://a.com"',
			label: 'http://a.com"',
			end: 13,
		});
	});
});

describe("literal email autolinks", () => {
	test("reads the address on both sides of the at sign and reports where it begins", () => {
		expect(matchLiteralEmail("a@b.com", 1, 0, 7)).toEqual({
			href: "mailto:a@b.com",
			label: "a@b.com",
			start: 0,
			end: 7,
		});
	});

	test("the local part may hold dots, hyphens, underscores and plus signs", () => {
		expect(matchLiteralEmail("a.b-c_d@a.b", 7, 0, 11)).toEqual({
			href: "mailto:a.b-c_d@a.b",
			label: "a.b-c_d@a.b",
			start: 0,
			end: 11,
		});
		expect(matchLiteralEmail("a+b@c.com", 3, 0, 9)?.label).toBe("a+b@c.com");
	});

	test("a domain ending in a hyphen or an underscore is prose", () => {
		expect(matchLiteralEmail("a.b-c_d@a.b-", 7, 0, 12)).toBeNull();
		expect(matchLiteralEmail("a.b-c_d@a.b_", 7, 0, 12)).toBeNull();
	});

	test("a hyphen inside the domain is part of the address", () => {
		expect(matchLiteralEmail("a@b-c.com", 1, 0, 9)?.label).toBe("a@b-c.com");
	});

	test("an underscore keeps a domain out of the last two labels", () => {
		expect(matchLiteralEmail("a@b_c.com", 1, 0, 9)).toBeNull();
	});

	test("a domain with no dot in it is not an address", () => {
		expect(matchLiteralEmail("a@b", 1, 0, 3)).toBeNull();
		expect(matchLiteralEmail("a@b..com", 1, 0, 8)).toBeNull();
	});

	test("a trailing dot belongs to the sentence, not to the domain", () => {
		expect(matchLiteralEmail("x a@b.com.", 3, 0, 10)).toEqual({
			href: "mailto:a@b.com",
			label: "a@b.com",
			start: 2,
			end: 9,
		});
	});

	test("an at sign with nothing before it is not an address", () => {
		expect(matchLiteralEmail("@b.com", 0, 0, 6)).toBeNull();
	});

	test("a local part that does not start at a boundary is prose", () => {
		expect(matchLiteralEmail("x!a@b.com", 3, 0, 9)).toBeNull();
	});

	test("a delimiter may sit right before the local part", () => {
		expect(matchLiteralEmail("*a@b.com", 2, 0, 8)).toEqual({
			href: "mailto:a@b.com",
			label: "a@b.com",
			start: 1,
			end: 8,
		});
	});

	test("the local part never reaches back past the start of the range", () => {
		expect(matchLiteralEmail("zzza@b.com", 4, 3, 10)).toEqual({
			href: "mailto:a@b.com",
			label: "a@b.com",
			start: 3,
			end: 10,
		});
	});

	test("a domain reaching past the range is not an address", () => {
		expect(matchLiteralEmail("a@b.com", 1, 0, 4)).toBeNull();
	});
});
