/**
 * Checks the inline phase against the constructs CommonMark, GFM, and this
 * dialect define, with the cases hand-written parsers get wrong — delimiter
 * runs, link destinations, and backtick spans — written out one by one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { isFailure, unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import type { Markdown } from "../index.js";

import type { Reference } from "./inline.js";
import type { Chunk } from "./source.js";

import { MarkdownParseError } from "./errors.js";
import { parseInlines } from "./inline.js";
import { resolveOptions } from "./options.js";
import { SourceText } from "./source.js";

/** The tags every tag test registers, one per `content` value the definition allows. */
const TAGS = {
	callout: { attributes: s.object({ type: s.string() }) },
	kbd: { content: "inline" },
	video: { content: "none", attributes: s.object({ src: s.string() }) },
	note: { content: "inline" },
} satisfies Markdown.Options["tags"];

/**
 * Builds the leaf text the block phase would hand over, one chunk per line, so a
 * multi-line case reports the lines it was written on.
 *
 * @param source - The leaf's text, newlines included
 * @returns The same text with source coordinates attached
 */
function source(text: string): SourceText {
	let offset = 0;
	let chunks: Chunk[] = [];

	for (let [index, line] of text.split("\n").entries()) {
		chunks.push({ text: line, line: index + 1, column: 1, offset });
		offset += line.length + 1;
	}

	return new SourceText(chunks);
}

/**
 * @param text - The leaf's text
 * @param options - The tags and references the document declares
 * @returns Whatever the inline phase made of it
 */
function parse(
	text: string,
	options: { tags?: Markdown.Options["tags"]; references?: Record<string, Reference> } = {},
): Result<Markdown.Inline[], MarkdownParseError> {
	return parseInlines(source(text), {
		references: new Map(Object.entries(options.references ?? {})),
		options: resolveOptions({ tags: options.tags }),
	});
}

/**
 * @param text - The leaf's text
 * @param options - The tags and references the document declares
 * @returns The nodes, failing the test when the phase rejected the text
 */
function nodes(
	text: string,
	options: { tags?: Markdown.Options["tags"]; references?: Record<string, Reference> } = {},
): Markdown.Inline[] {
	return unwrap(parse(text, options));
}

/**
 * @param text - The leaf's text
 * @param options - The tags the document declares
 * @returns The error the phase reported, failing the test when it reported none
 */
function error(
	text: string,
	options: { tags?: Markdown.Options["tags"] } = {},
): MarkdownParseError {
	let result = parse(text, options);
	if (!isFailure(result)) throw new Error(`Expected ${JSON.stringify(text)} to fail`);
	return result.error;
}

/**
 * Flattens a tree into the shape the assertions compare, so a case names the
 * structure it cares about instead of every position along the way.
 *
 * @param list - The nodes to describe
 * @returns The same nodes with positions dropped
 */
function shape(list: Markdown.Inline[]): unknown[] {
	return list.map((node) => {
		let { position: _position, ...rest } = node as Markdown.Inline & {
			children?: Markdown.Inline[];
		};
		if ("children" in rest && Array.isArray(rest.children)) {
			return { ...rest, children: shape(rest.children as Markdown.Inline[]) };
		}
		return rest;
	});
}

describe("text, escapes and breaks", () => {
	test("reads a plain line as one text node", () => {
		expect(shape(nodes("hello world"))).toEqual([{ type: "text", value: "hello world" }]);
	});

	test("a backslash escapes ASCII punctuation", () => {
		expect(shape(nodes("\\*not emphasis\\*"))).toEqual([{ type: "text", value: "*not emphasis*" }]);
	});

	test("a backslash before anything else is literal", () => {
		expect(shape(nodes("\\a"))).toEqual([{ type: "text", value: "\\a" }]);
	});

	test("a backslash at the end of a line is a hard break", () => {
		expect(shape(nodes("foo\\\nbar"))).toEqual([
			{ type: "text", value: "foo" },
			{ type: "hardBreak" },
			{ type: "text", value: "bar" },
		]);
	});

	test("two trailing spaces make a hard break and leave no spaces behind", () => {
		expect(shape(nodes("foo  \nbar"))).toEqual([
			{ type: "text", value: "foo" },
			{ type: "hardBreak" },
			{ type: "text", value: "bar" },
		]);
	});

	test("one trailing space makes a soft break", () => {
		expect(shape(nodes("foo \nbar"))).toEqual([
			{ type: "text", value: "foo" },
			{ type: "softBreak" },
			{ type: "text", value: "bar" },
		]);
	});

	test("spaces the leaf trails belong to no node", () => {
		expect(shape(nodes("foo  "))).toEqual([{ type: "text", value: "foo" }]);
	});

	test("a break swallows the spaces the next line opens with", () => {
		expect(shape(nodes("foo\n     bar"))).toEqual([
			{ type: "text", value: "foo" },
			{ type: "softBreak" },
			{ type: "text", value: "bar" },
		]);
	});
});

describe("character references", () => {
	test("resolves a named reference into the text", () => {
		expect(shape(nodes("a &amp; b"))).toEqual([{ type: "text", value: "a & b" }]);
	});

	test("resolves a decimal reference", () => {
		expect(shape(nodes("&#35;"))).toEqual([{ type: "text", value: "#" }]);
	});

	test("resolves a hexadecimal reference in either case", () => {
		expect(shape(nodes("&#X22; &#x22;"))).toEqual([{ type: "text", value: '" "' }]);
	});

	test("substitutes the replacement character for a reference naming nothing", () => {
		expect(shape(nodes("&#0; &#xD800; &#x110000;"))).toEqual([
			{ type: "text", value: "\uFFFD \uFFFD \uFFFD" },
		]);
	});

	test("leaves an unknown name as written", () => {
		expect(shape(nodes("&nowhere; &amp"))).toEqual([{ type: "text", value: "&nowhere; &amp" }]);
	});

	test("a reference never begins a construct", () => {
		expect(shape(nodes("&#42;not emphasis&#42;"))).toEqual([
			{ type: "text", value: "*not emphasis*" },
		]);
	});
});

describe("code spans", () => {
	test("reads a single backtick span", () => {
		expect(shape(nodes("a `code` b"))).toEqual([
			{ type: "text", value: "a " },
			{ type: "inlineCode", value: "code" },
			{ type: "text", value: " b" },
		]);
	});

	test("a longer run closes only on a run of the same length", () => {
		expect(shape(nodes("`` a ` b ``"))).toEqual([{ type: "inlineCode", value: "a ` b" }]);
	});

	test("strips one space from each end when both are there", () => {
		expect(shape(nodes("` `` `"))).toEqual([{ type: "inlineCode", value: "``" }]);
	});

	test("keeps a span that is only spaces", () => {
		expect(shape(nodes("`  `"))).toEqual([{ type: "inlineCode", value: "  " }]);
	});

	test("turns line endings inside a span into spaces", () => {
		expect(shape(nodes("`a\nb`"))).toEqual([{ type: "inlineCode", value: "a b" }]);
	});

	test("an unclosed run stays literal", () => {
		expect(shape(nodes("``a`"))).toEqual([{ type: "text", value: "``a`" }]);
	});

	test("a code span binds tighter than emphasis", () => {
		expect(shape(nodes("*a`b*c`"))).toEqual([
			{ type: "text", value: "*a" },
			{ type: "inlineCode", value: "b*c" },
		]);
	});
});

describe("emphasis and strong emphasis", () => {
	test("reads a single delimiter run as emphasis", () => {
		expect(shape(nodes("*foo*"))).toEqual([
			{ type: "emphasis", children: [{ type: "text", value: "foo" }] },
		]);
	});

	test("reads a double delimiter run as strong", () => {
		expect(shape(nodes("**foo**"))).toEqual([
			{ type: "strong", children: [{ type: "text", value: "foo" }] },
		]);
	});

	test("nests a triple run as emphasis around strong", () => {
		expect(shape(nodes("***foo***"))).toEqual([
			{
				type: "emphasis",
				children: [{ type: "strong", children: [{ type: "text", value: "foo" }] }],
			},
		]);
	});

	test("an underscore run may not open inside a word", () => {
		expect(shape(nodes("foo_bar_baz"))).toEqual([{ type: "text", value: "foo_bar_baz" }]);
	});

	test("an asterisk run may open inside a word", () => {
		expect(shape(nodes("foo*bar*baz"))).toEqual([
			{ type: "text", value: "foo" },
			{ type: "emphasis", children: [{ type: "text", value: "bar" }] },
			{ type: "text", value: "baz" },
		]);
	});

	test("a run followed by whitespace cannot open", () => {
		expect(shape(nodes("a * b *"))).toEqual([{ type: "text", value: "a * b *" }]);
	});

	test("the rule of three keeps a middle run out of a pair", () => {
		expect(shape(nodes("*foo**bar*"))).toEqual([
			{ type: "emphasis", children: [{ type: "text", value: "foo**bar" }] },
		]);
	});

	test("a strong run nests inside emphasis when both close", () => {
		expect(shape(nodes("*foo**bar**baz*"))).toEqual([
			{
				type: "emphasis",
				children: [
					{ type: "text", value: "foo" },
					{ type: "strong", children: [{ type: "text", value: "bar" }] },
					{ type: "text", value: "baz" },
				],
			},
		]);
	});

	test("an unmatched run stays literal beside the span it could not join", () => {
		expect(shape(nodes("**foo*"))).toEqual([
			{ type: "text", value: "*" },
			{ type: "emphasis", children: [{ type: "text", value: "foo" }] },
		]);
	});

	test("emphasis reaches across a soft break", () => {
		expect(shape(nodes("*foo\nbar*"))).toEqual([
			{
				type: "emphasis",
				children: [
					{ type: "text", value: "foo" },
					{ type: "softBreak" },
					{ type: "text", value: "bar" },
				],
			},
		]);
	});
});

describe("strikethrough", () => {
	test("reads a double tilde run", () => {
		expect(shape(nodes("~~gone~~"))).toEqual([
			{ type: "strikethrough", children: [{ type: "text", value: "gone" }] },
		]);
	});

	test("reads a single tilde run", () => {
		expect(shape(nodes("~gone~"))).toEqual([
			{ type: "strikethrough", children: [{ type: "text", value: "gone" }] },
		]);
	});

	test("a run of three or more tildes is literal", () => {
		expect(shape(nodes("~~~gone~~~"))).toEqual([{ type: "text", value: "~~~gone~~~" }]);
	});

	test("runs of different lengths do not pair", () => {
		expect(shape(nodes("~~gone~"))).toEqual([{ type: "text", value: "~~gone~" }]);
	});
});

describe("links", () => {
	test("reads an inline link", () => {
		expect(shape(nodes("[text](/dest)"))).toEqual([
			{ type: "link", href: "/dest", children: [{ type: "text", value: "text" }] },
		]);
	});

	test("reads a title beside the destination", () => {
		expect(shape(nodes('[text](/dest "the title")'))).toEqual([
			{
				type: "link",
				href: "/dest",
				title: "the title",
				children: [{ type: "text", value: "text" }],
			},
		]);
	});

	test("reads a pointy-bracket destination holding spaces", () => {
		expect(shape(nodes("[text](</a b>)"))).toEqual([
			{ type: "link", href: "/a b", children: [{ type: "text", value: "text" }] },
		]);
	});

	test("reads a bare destination with balanced parentheses", () => {
		expect(shape(nodes("[text](/a(b)c)"))).toEqual([
			{ type: "link", href: "/a(b)c", children: [{ type: "text", value: "text" }] },
		]);
	});

	test("resolves escapes and references inside a destination", () => {
		expect(shape(nodes("[text](/a\\(b&amp;c)"))).toEqual([
			{ type: "link", href: "/a(b&c", children: [{ type: "text", value: "text" }] },
		]);
	});

	test("only ASCII space ends a bare destination", () => {
		expect(shape(nodes("[text](/a\u00a0b)"))).toEqual([
			{ type: "link", href: "/a\u00a0b", children: [{ type: "text", value: "text" }] },
		]);
	});

	test("reads an empty destination", () => {
		expect(shape(nodes("[text]()"))).toEqual([
			{ type: "link", href: "", children: [{ type: "text", value: "text" }] },
		]);
	});

	test("resolves a full reference", () => {
		expect(shape(nodes("[text][label]", { references: { LABEL: { href: "/d" } } }))).toEqual([
			{ type: "link", href: "/d", children: [{ type: "text", value: "text" }] },
		]);
	});

	test("resolves a collapsed reference", () => {
		expect(shape(nodes("[text][]", { references: { TEXT: { href: "/d", title: "t" } } }))).toEqual([
			{ type: "link", href: "/d", title: "t", children: [{ type: "text", value: "text" }] },
		]);
	});

	test("resolves a shortcut reference", () => {
		expect(shape(nodes("[text]", { references: { TEXT: { href: "/d" } } }))).toEqual([
			{ type: "link", href: "/d", children: [{ type: "text", value: "text" }] },
		]);
	});

	test("leaves a reference naming no definition as written", () => {
		expect(shape(nodes("[text][missing]"))).toEqual([{ type: "text", value: "[text][missing]" }]);
	});

	test("emphasis inside a link's text belongs to the link", () => {
		expect(shape(nodes("[*a*](/d)"))).toEqual([
			{
				type: "link",
				href: "/d",
				children: [{ type: "emphasis", children: [{ type: "text", value: "a" }] }],
			},
		]);
	});

	test("brackets bind tighter than emphasis", () => {
		expect(shape(nodes("*[a*](/d)"))).toEqual([
			{ type: "text", value: "*" },
			{ type: "link", href: "/d", children: [{ type: "text", value: "a*" }] },
		]);
	});

	test("links may not contain other links", () => {
		expect(shape(nodes("[a [b](/c) d](/e)"))).toEqual([
			{ type: "text", value: "[a " },
			{ type: "link", href: "/c", children: [{ type: "text", value: "b" }] },
			{ type: "text", value: " d](/e)" },
		]);
	});

	test("reads an image", () => {
		expect(shape(nodes("![alt](/img.png)"))).toEqual([
			{ type: "image", src: "/img.png", children: [{ type: "text", value: "alt" }] },
		]);
	});

	test("an image may sit inside a link", () => {
		expect(shape(nodes("[![alt](/i.png)](/d)"))).toEqual([
			{
				type: "link",
				href: "/d",
				children: [{ type: "image", src: "/i.png", children: [{ type: "text", value: "alt" }] }],
			},
		]);
	});
});

describe("autolinks", () => {
	test("reads an absolute URI in angle brackets", () => {
		expect(shape(nodes("<https://example.com/a>"))).toEqual([
			{
				type: "link",
				href: "https://example.com/a",
				children: [{ type: "text", value: "https://example.com/a" }],
			},
		]);
	});

	test("reads an email address in angle brackets", () => {
		expect(shape(nodes("<foo@example.com>"))).toEqual([
			{
				type: "link",
				href: "mailto:foo@example.com",
				children: [{ type: "text", value: "foo@example.com" }],
			},
		]);
	});

	test("reads a bare URL as a link", () => {
		expect(shape(nodes("see https://example.com/a for more"))).toEqual([
			{ type: "text", value: "see " },
			{
				type: "link",
				href: "https://example.com/a",
				children: [{ type: "text", value: "https://example.com/a" }],
			},
			{ type: "text", value: " for more" },
		]);
	});

	test("gives a bare host the http scheme", () => {
		expect(shape(nodes("www.example.com"))).toEqual([
			{
				type: "link",
				href: "http://www.example.com",
				children: [{ type: "text", value: "www.example.com" }],
			},
		]);
	});

	test("leaves sentence punctuation out of a bare URL", () => {
		expect(shape(nodes("at https://example.com."))).toEqual([
			{ type: "text", value: "at " },
			{
				type: "link",
				href: "https://example.com",
				children: [{ type: "text", value: "https://example.com" }],
			},
			{ type: "text", value: "." },
		]);
	});

	test("leaves an unopened closing parenthesis out of a bare URL", () => {
		expect(shape(nodes("(see https://example.com/a)"))).toEqual([
			{ type: "text", value: "(see " },
			{
				type: "link",
				href: "https://example.com/a",
				children: [{ type: "text", value: "https://example.com/a" }],
			},
			{ type: "text", value: ")" },
		]);
	});

	test("reads a bare email address", () => {
		expect(shape(nodes("write to hi@example.com today"))).toEqual([
			{ type: "text", value: "write to " },
			{
				type: "link",
				href: "mailto:hi@example.com",
				children: [{ type: "text", value: "hi@example.com" }],
			},
			{ type: "text", value: " today" },
		]);
	});

	test("a host inside a word is prose", () => {
		expect(shape(nodes("awww.example.com"))).toEqual([{ type: "text", value: "awww.example.com" }]);
	});

	test("reads a bare ftp URL as a link", () => {
		expect(shape(nodes("Anonymous FTP is available at ftp://foo.bar.baz."))).toEqual([
			{ type: "text", value: "Anonymous FTP is available at " },
			{
				type: "link",
				href: "ftp://foo.bar.baz",
				children: [{ type: "text", value: "ftp://foo.bar.baz" }],
			},
			{ type: "text", value: "." },
		]);
	});

	test("a word beginning with f is prose", () => {
		expect(shape(nodes("ftp is a protocol"))).toEqual([
			{ type: "text", value: "ftp is a protocol" },
		]);
	});

	test("reads a bare email whose local part holds dots, hyphens and underscores", () => {
		expect(shape(nodes("a.b-c_d@a.b"))).toEqual([
			{
				type: "link",
				href: "mailto:a.b-c_d@a.b",
				children: [{ type: "text", value: "a.b-c_d@a.b" }],
			},
		]);
	});

	test("leaves a trailing dot out of a bare email", () => {
		expect(shape(nodes("a.b-c_d@a.b."))).toEqual([
			{
				type: "link",
				href: "mailto:a.b-c_d@a.b",
				children: [{ type: "text", value: "a.b-c_d@a.b" }],
			},
			{ type: "text", value: "." },
		]);
	});

	test("a domain ending in a hyphen or an underscore is prose", () => {
		expect(shape(nodes("a.b-c_d@a.b-"))).toEqual([{ type: "text", value: "a.b-c_d@a.b-" }]);
		expect(shape(nodes("a.b-c_d@a.b_"))).toEqual([{ type: "text", value: "a.b-c_d@a.b_" }]);
	});

	test("an emphasis opener before a bare email stays a delimiter", () => {
		expect(shape(nodes("_a_ b_c@d.e"))).toEqual([
			{ type: "emphasis", children: [{ type: "text", value: "a" }] },
			{ type: "text", value: " " },
			{
				type: "link",
				href: "mailto:b_c@d.e",
				children: [{ type: "text", value: "b_c@d.e" }],
			},
		]);
	});
});

describe("footnote references", () => {
	test("reads a reference and normalizes its identifier", () => {
		expect(shape(nodes("a[^Note 1]"))).toEqual([
			{ type: "text", value: "a" },
			{ type: "footnoteReference", identifier: "note 1" },
		]);
	});

	test("an empty caret label stays a link bracket", () => {
		expect(shape(nodes("[^]"))).toEqual([{ type: "text", value: "[^]" }]);
	});
});

describe("raw inline HTML", () => {
	test("holds an unregistered element as written", () => {
		expect(shape(nodes('<span class="a">x</span>'))).toEqual([
			{ type: "inlineHtml", value: '<span class="a">' },
			{ type: "text", value: "x" },
			{ type: "inlineHtml", value: "</span>" },
		]);
	});

	test("holds a comment as written", () => {
		expect(shape(nodes("a<!-- c -->b"))).toEqual([
			{ type: "text", value: "a" },
			{ type: "inlineHtml", value: "<!-- c -->" },
			{ type: "text", value: "b" },
		]);
	});

	test("a lone angle bracket is text", () => {
		expect(shape(nodes("a < b"))).toEqual([{ type: "text", value: "a < b" }]);
	});
});

describe("variables", () => {
	test("reads a variable out of an annotation", () => {
		expect(shape(nodes("Hello {% $name %}!"))).toEqual([
			{ type: "text", value: "Hello " },
			{ type: "variable", name: "name" },
			{ type: "text", value: "!" },
		]);
	});

	test("an annotation that is not a variable is text", () => {
		expect(shape(nodes('{% class="x" %}'))).toEqual([{ type: "text", value: '{% class="x" %}' }]);
	});

	test("nothing is a variable inside a code span", () => {
		expect(shape(nodes("`{% $name %}`"))).toEqual([{ type: "inlineCode", value: "{% $name %}" }]);
	});

	test("an escaped brace writes the delimiters as prose", () => {
		expect(shape(nodes("\\{% $name %}"))).toEqual([{ type: "text", value: "{% $name %}" }]);
	});

	test("a bare dollar sign is prose", () => {
		expect(shape(nodes("$5/month and US$100"))).toEqual([
			{ type: "text", value: "$5/month and US$100" },
		]);
	});
});

describe("inline tags", () => {
	test("reads a registered inline tag", () => {
		expect(shape(nodes("Press <kbd>Cmd</kbd> to act", { tags: TAGS }))).toEqual([
			{ type: "text", value: "Press " },
			{ type: "tag", name: "kbd", attributes: {}, children: [{ type: "text", value: "Cmd" }] },
			{ type: "text", value: " to act" },
		]);
	});

	test("a tag's children are markdown", () => {
		expect(shape(nodes("<kbd>**a**</kbd>", { tags: TAGS }))).toEqual([
			{
				type: "tag",
				name: "kbd",
				attributes: {},
				children: [{ type: "strong", children: [{ type: "text", value: "a" }] }],
			},
		]);
	});

	test("tags nest by name", () => {
		expect(shape(nodes("<kbd>a<kbd>b</kbd>c</kbd>", { tags: TAGS }))).toEqual([
			{
				type: "tag",
				name: "kbd",
				attributes: {},
				children: [
					{ type: "text", value: "a" },
					{ type: "tag", name: "kbd", attributes: {}, children: [{ type: "text", value: "b" }] },
					{ type: "text", value: "c" },
				],
			},
		]);
	});

	test("an unregistered element stays raw HTML", () => {
		expect(shape(nodes("<kbd>a</kbd>"))).toEqual([
			{ type: "inlineHtml", value: "<kbd>" },
			{ type: "text", value: "a" },
			{ type: "inlineHtml", value: "</kbd>" },
		]);
	});

	test("reads attributes the way JSX writes them", () => {
		expect(shape(nodes('<video src="/a.mp4" />', { tags: TAGS }))).toEqual([
			{ type: "tag", name: "video", attributes: { src: "/a.mp4" }, children: [] },
		]);
	});

	test("a tag whose children are blocks may be written self-closing", () => {
		expect(shape(nodes('<callout type="info" />', { tags: TAGS }))).toEqual([
			{ type: "tag", name: "callout", attributes: { type: "info" }, children: [] },
		]);
	});

	test("a tag whose children are blocks has nowhere to put them inside a line", () => {
		let reported = error('a <callout type="info">b</callout>', { tags: TAGS });

		expect(reported).toBeInstanceOf(MarkdownParseError);
		expect(reported.message).toContain("blocks");
		expect(reported.position?.start.line).toBe(1);
		expect(reported.position?.start.column).toBe(3);
	});

	test("a tag holding no children is written self-closing", () => {
		let reported = error('<video src="/a.mp4">x</video>', { tags: TAGS });

		expect(reported.message).toContain("self-closing");
		expect(reported.position?.start.column).toBe(1);
	});

	test("a tag left open at the end of the text names its opener", () => {
		let reported = error("Press <kbd>Cmd", { tags: TAGS });

		expect(reported.message).toContain("never closed");
		expect(reported.position?.start.column).toBe(7);
	});

	test("a tag whose attributes the schema rejects reports the issues at the opener", () => {
		let reported = error("<video />", { tags: TAGS });

		expect(reported.message).toContain("invalid");
		expect(reported.issues.length).toBeGreaterThan(0);
		expect(reported.position?.start.line).toBe(1);
	});

	test("a tag whose attributes cannot be read names the opener", () => {
		let reported = error("<note key= >a</note>", { tags: TAGS });

		expect(reported.message).toContain("unreadable");
	});
});

describe("positions", () => {
	test("a text node spans what the source wrote", () => {
		let [node] = nodes("hello");

		expect(node?.position).toEqual({
			start: { line: 1, column: 1, offset: 0 },
			end: { line: 1, column: 6, offset: 5 },
		});
	});

	test("emphasis spans its delimiters and everything between", () => {
		let [, emphasis] = nodes("a *b* c");

		expect(emphasis?.position).toEqual({
			start: { line: 1, column: 3, offset: 2 },
			end: { line: 1, column: 6, offset: 5 },
		});
	});

	test("a node on the second line reports the second line", () => {
		let [, , code] = nodes("a\n`b`");

		expect(code?.position.start).toEqual({ line: 2, column: 1, offset: 2 });
	});

	test("a link spans from its bracket to its closing parenthesis", () => {
		let [link] = nodes("[a](/b)");

		expect(link?.position.end).toEqual({ line: 1, column: 8, offset: 7 });
	});

	test("a variable spans its delimiters", () => {
		let [, variable] = nodes("x {% $name %}");

		expect(variable?.position).toEqual({
			start: { line: 1, column: 3, offset: 2 },
			end: { line: 1, column: 14, offset: 13 },
		});
	});
});
