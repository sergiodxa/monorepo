/**
 * The seven kinds of HTML block, one describe each: the lines that open a kind,
 * the lines that only look like they do, and the marker or blank line each kind
 * ends on. The seventh is covered as the catch-all a paragraph is safe from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { closesHtmlBlock, readHtmlBlockKind } from "./html.js";

describe("kind 1, the raw-text elements", () => {
	test("opens on script, pre, style or textarea", () => {
		expect(readHtmlBlockKind("<script>", false)).toBe(1);
		expect(readHtmlBlockKind("<pre>", false)).toBe(1);
		expect(readHtmlBlockKind("<style>", false)).toBe(1);
		expect(readHtmlBlockKind("<textarea>", false)).toBe(1);
	});

	test("opens on a name the line ends right after", () => {
		expect(readHtmlBlockKind("<pre", false)).toBe(1);
	});

	test("opens whatever case the name is written in", () => {
		expect(readHtmlBlockKind('<SCRIPT type="text/javascript">', false)).toBe(1);
	});

	test("leaves a longer name that merely starts the same to another kind", () => {
		expect(readHtmlBlockKind("<scriptx>", false)).toBe(7);
	});

	test("ends on a closing tag anywhere in the line, not only alone on it", () => {
		expect(closesHtmlBlock(1, "body </script> trailing")).toBe(true);
		expect(closesHtmlBlock(1, "</PRE>")).toBe(true);
	});

	test("runs on through a blank line, which is why it needs its closer", () => {
		expect(closesHtmlBlock(1, "")).toBe(false);
		expect(closesHtmlBlock(1, "still raw")).toBe(false);
	});
});

describe("kind 2, the comment", () => {
	test("opens on a comment's own delimiter", () => {
		expect(readHtmlBlockKind("<!-- note -->", false)).toBe(2);
	});

	test("leaves a declaration-looking line that is no comment to another kind", () => {
		expect(readHtmlBlockKind("<!->", false)).toBe(null);
	});

	test("ends on the comment's closing delimiter", () => {
		expect(closesHtmlBlock(2, "note --> after")).toBe(true);
		expect(closesHtmlBlock(2, "note - - >")).toBe(false);
	});
});

describe("kind 3, the processing instruction", () => {
	test("opens on a processing instruction", () => {
		expect(readHtmlBlockKind("<?php echo $x;", false)).toBe(3);
	});

	test("ends on the instruction's closing marker", () => {
		expect(closesHtmlBlock(3, "?>")).toBe(true);
		expect(closesHtmlBlock(3, "?")).toBe(false);
	});
});

describe("kind 4, the declaration", () => {
	test("opens on a declaration", () => {
		expect(readHtmlBlockKind("<!DOCTYPE html>", false)).toBe(4);
	});

	test("ends on the first angle bracket that closes it", () => {
		expect(closesHtmlBlock(4, "html>")).toBe(true);
		expect(closesHtmlBlock(4, "html")).toBe(false);
	});
});

describe("kind 5, the CDATA section", () => {
	test("opens on a CDATA section", () => {
		expect(readHtmlBlockKind("<![CDATA[ raw", false)).toBe(5);
	});

	test("ends on the section's closing marker", () => {
		expect(closesHtmlBlock(5, "raw ]]> after")).toBe(true);
		expect(closesHtmlBlock(5, "raw ]> after")).toBe(false);
	});
});

describe("kind 6, the block-level element names", () => {
	test("opens on a known block-level name, opening or closing", () => {
		expect(readHtmlBlockKind("<div>", false)).toBe(6);
		expect(readHtmlBlockKind("</div>", false)).toBe(6);
		expect(readHtmlBlockKind('<table class="wide">', false)).toBe(6);
		expect(readHtmlBlockKind("<div/>", false)).toBe(6);
	});

	test("opens on a name the line ends right after", () => {
		expect(readHtmlBlockKind("<div", false)).toBe(6);
	});

	test("opens whatever case the name is written in", () => {
		expect(readHtmlBlockKind("<DIV>", false)).toBe(6);
	});

	test("takes the longest name that fits, so a prefix does not steal the line", () => {
		expect(readHtmlBlockKind("<header>", false)).toBe(6);
		expect(readHtmlBlockKind('<link rel="x">', false)).toBe(6);
	});

	test("leaves a name that is not block-level to the catch-all", () => {
		expect(readHtmlBlockKind("<del>", false)).toBe(7);
		expect(readHtmlBlockKind("<prefix>", false)).toBe(7);
	});

	test("ends at a blank line, so no marker ever closes it", () => {
		expect(closesHtmlBlock(6, "</div>")).toBe(false);
		expect(closesHtmlBlock(6, "")).toBe(false);
	});
});

describe("kind 7, the complete tag alone on its line", () => {
	test("opens on a complete open tag, with attributes or self-closing", () => {
		expect(readHtmlBlockKind('<a href="/x">', false)).toBe(7);
		expect(readHtmlBlockKind("<x-custom data-a=1 />", false)).toBe(7);
	});

	test("opens on a complete closing tag", () => {
		expect(readHtmlBlockKind("</a>", false)).toBe(7);
	});

	test("allows trailing whitespace after the tag but no other content", () => {
		expect(readHtmlBlockKind('<a href="/x">   ', false)).toBe(7);
		expect(readHtmlBlockKind('<a href="/x"> text', false)).toBe(null);
	});

	test("cannot interrupt a paragraph, so prose that opens with an element stays prose", () => {
		expect(readHtmlBlockKind('<a href="/x">', true)).toBe(null);
		expect(readHtmlBlockKind("<del>", true)).toBe(null);
	});

	test("ends at a blank line, so no marker ever closes it", () => {
		expect(closesHtmlBlock(7, "</a>")).toBe(false);
		expect(closesHtmlBlock(7, "")).toBe(false);
	});
});

describe("lines that open no HTML block", () => {
	test("rejects a tag name that does not begin with a letter", () => {
		expect(readHtmlBlockKind("<1nvalid>", false)).toBe(null);
	});

	test("rejects an open tag the line never closes", () => {
		expect(readHtmlBlockKind("<a href=x", false)).toBe(null);
	});

	test("rejects a closing tag carrying attributes", () => {
		expect(readHtmlBlockKind('</a href="/x">', false)).toBe(null);
	});

	test("rejects a line whose angle bracket is not the tag's own", () => {
		expect(readHtmlBlockKind("< div>", false)).toBe(null);
		expect(readHtmlBlockKind("plain prose", false)).toBe(null);
	});

	test("lets the first six kinds interrupt a paragraph", () => {
		expect(readHtmlBlockKind("<script>", true)).toBe(1);
		expect(readHtmlBlockKind("<!-- note -->", true)).toBe(2);
		expect(readHtmlBlockKind("<?php", true)).toBe(3);
		expect(readHtmlBlockKind("<!DOCTYPE html>", true)).toBe(4);
		expect(readHtmlBlockKind("<![CDATA[", true)).toBe(5);
		expect(readHtmlBlockKind("<div>", true)).toBe(6);
	});
});

describe("a kind that closes on nothing", () => {
	test("answers no for a kind that carries no closing marker", () => {
		expect(closesHtmlBlock(0, "<div>")).toBe(false);
	});
});
